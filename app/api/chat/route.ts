import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

import { getRepositoryContext } from "@/services/repository-context-store.server";
import type { ChatMessage, RepositoryContext } from "@/types/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) return null;
  const text = readFileSync(filePath, "utf-8");
  const match = text.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^"'\n\r]+)["']?\s*$/m);
  return match?.[1] ?? null;
}

function getOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  const candidates = [".env.local", ".env", ".env.development", ".env.production", ".env.example"];
  for (const candidate of candidates) {
    const value = parseEnvFile(join(process.cwd(), candidate));
    if (value) return value;
  }

  return null;
}

function getRelevantMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user" || message.content.trim())
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content }));
}

function buildChatMessages(context: RepositoryContext, messages: ChatMessage[]) {
  const brief = buildRepositoryBrief(context).prompt;
  const chatHistory = getRelevantMessages(messages).map((message) => ({ role: message.role, content: message.content }));

  return [
    {
      role: "system",
      content: `You are ChatGPT, a helpful assistant specialized in analyzing repositories. Use the provided repository context to answer questions accurately and fluently. If the answer is not in the repository context, say so clearly and avoid guessing. ${brief}`,
    },
    ...chatHistory,
  ];
}

function getLatestUserQuestion(messages: ChatMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.content.trim() || "";
}

function localFallbackAnswer(question: string, context: RepositoryContext) {
  const normalized = question.toLowerCase();
  if (normalized.includes("architecture") || normalized.includes("modules") || normalized.includes("structure")) {
    return `Repository architecture summary:\n${context.analysis.summary}\n\nKey modules:\n${context.analysis.modules
      .map((module) => `- ${module.name}: ${module.files.join(", ")}`)
      .join("\n")}`;
  }

  if (normalized.includes("auth") || normalized.includes("authentication") || normalized.includes("jwt") || normalized.includes("login")) {
    const authModule = context.analysis.modules.find((module) => module.name.toLowerCase().includes("auth"));
    return authModule
      ? `Authentication appears in ${authModule.name}. Relevant files: ${authModule.files.join(", ")}. Check the repository for auth-related input validation and session handling.`
      : `Authentication is not clearly marked in the current module classification, but review auth-related files in the repository for login, token, and session handling.`;
  }

  if (normalized.includes("payment") || normalized.includes("checkout") || normalized.includes("order")) {
    return `This repository includes payment and checkout flows. Look for files under payments, checkout, or API routes that handle cart state and order submission. The repository summary can help locate the exact service boundaries.`;
  }

  return `Repository summary:\n${context.analysis.summary}\n\nUse the repository context to inspect architecture, dependencies, authentication, risk, and impact flows.`;
}

async function fetchWithTimeout(resource: string, options: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function extractTextFromResponse(responseJson: any) {
  if (!responseJson) return "";
  if (typeof responseJson === "string") return responseJson;
  if (typeof responseJson.output_text === "string") return responseJson.output_text;
  if (Array.isArray(responseJson.output)) return responseJson.output.map((item: any) => extractTextFromResponse(item)).join("\n");
  if (typeof responseJson.text === "string") return responseJson.text;
  if (Array.isArray(responseJson.content)) return responseJson.content.map((item: any) => extractTextFromResponse(item)).join("");
  if (Array.isArray(responseJson.choices)) return responseJson.choices.map((choice: any) => extractTextFromResponse(choice)).join("\n");
  if (typeof responseJson.message === "object") return extractTextFromResponse(responseJson.message);
  return "";
}

const openAIKey = getOpenAIKey();

function buildRepositoryBrief(context: RepositoryContext) {
  const fileReferences = context.files.filter((file) => file.preview).slice(0, 18).map((file) => `FILE: ${file.path}\n${file.preview?.slice(0, 1200)}`).join("\n\n");
  return { context, prompt: `You are GitLens AI, a precise senior engineer helping a developer understand a specific repository. Only make claims supported by the supplied repository context. If the answer is not present, say what is missing. Use concise Markdown. When citing code, name the exact file paths and relevant functions/classes.\n\nREPOSITORY SUMMARY:\n${context.analysis.summary}\n\nFRAMEWORKS: ${context.analysis.frameworks.join(", ") || "Not detected"}\nLANGUAGES: ${context.analysis.languages.map((language) => `${language.name} (${language.files})`).join(", ") || "Not detected"}\nMODULES:\n${context.analysis.modules.map((module) => `${module.name}: ${module.files.join(", ")}`).join("\n") || "Not classified"}\n\nSOURCE EXCERPTS:\n${fileReferences}` };
}

export async function POST(request: Request) {
  try {
    const { repositoryId, messages } = await request.json() as { repositoryId?: string; messages?: ChatMessage[] };
    if (!repositoryId || !messages?.length) throw new Error("A repository and at least one message are required.");
    const context = await getRepositoryContext(repositoryId);
    if (!context) throw new Error("Repository context not found. Import the repository again before chatting.");
    const apiKey = getOpenAIKey();
    const requestInput = getRelevantMessages(messages);
    const latestQuestion = getLatestUserQuestion(messages);
    if (!requestInput.length) throw new Error("Unable to build the request for the chat model.");

    if (!apiKey) {
      const answer = localFallbackAnswer(latestQuestion, context);
      return NextResponse.json({ answer });
    }

    let upstream;
    try {
      upstream = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: buildChatMessages(context, messages),
          temperature: 0.2,
          max_tokens: 400,
          top_p: 0.95,
          n: 1,
        }),
      });
    } catch {
      const fallback = localFallbackAnswer(latestQuestion, context);
      return NextResponse.json({ answer: fallback });
    }

    if (!upstream?.ok) {
      const fallback = localFallbackAnswer(latestQuestion, context);
      return NextResponse.json({ answer: fallback });
    }

    let responseJson: any;
    try {
      responseJson = await upstream.json();
    } catch {
      responseJson = null;
    }

    let answer = "";
    if (responseJson?.choices && Array.isArray(responseJson.choices) && responseJson.choices[0]?.message?.content) {
      answer = String(responseJson.choices[0].message.content).trim();
    } else {
      answer = extractTextFromResponse(responseJson).trim();
    }

    if (!answer) {
      answer = localFallbackAnswer(latestQuestion, context);
    }

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start the AI response.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
