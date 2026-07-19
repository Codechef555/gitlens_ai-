"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUp, Bot, FileCode2, LoaderCircle, Sparkles } from "lucide-react";

import { MarkdownMessage } from "@/features/ai-chat/components/markdown-message";
import type { ChatMessage, RepositoryContext } from "@/types/repository";

const suggestions = [
  "Explain the authentication flow",
  "Where is JWT verified?",
  "Explain the state management",
  "Trace the payment flow",
];

export function RepositoryChat({
  repositoryId,
  embedded = false,
}: {
  repositoryId: string;
  embedded?: boolean;
}) {
  const [context, setContext] = useState<RepositoryContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!repositoryId) {
      setError("Open this page from a repository or add ?repository=<id> to the URL.");
      setLoading(false);
      return;
    }

    fetch(`/api/repositories/${repositoryId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setContext(data);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load repository context."))
      .finally(() => setLoading(false));
  }, [repositoryId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isComposing) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event as unknown as FormEvent);
    }
  }

  function handleCompositionStart() {
    setIsComposing(true);
  }

  function handleCompositionEnd() {
    setIsComposing(false);
  }

  const header = useMemo(
    () =>
      context
        ? `${context.repository.name} · ${context.analysis.frameworks.join(", ") || context.repository.primaryLanguage}`
        : "Repository chat",
    [context],
  );

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <section className="rounded-3xl border border-white/[.08] bg-zinc-900/60 p-4 shadow-xl shadow-black/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/[.08] bg-zinc-950/80 p-4">
          <div>
            <p className="text-sm font-semibold text-white">Repository chat</p>
            <p className="text-xs text-zinc-500">Ask questions about the repository files, architecture, and behavior.</p>
          </div>
          <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">AI assistant</span>
        </div>
        {children}
      </section>
    ) : (
      <ChatShell header={header}>{children}</ChatShell>
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming || !repositoryId) return;

    const user: ChatMessage = {
      id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };

    const assistant: ChatMessage = {
      id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, user];
    setInput("");
    setMessages((current) => [...current, user, assistant]);
    setStreaming(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId, messages: updatedMessages }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to get an answer.");
      }

      const answer = (typeof data.answer === "string" ? data.answer : "").trim();
      const safeAnswer = answer || "I'm sorry, I couldn't generate an answer for that query. Please try asking another repo question.";
      setMessages((current) =>
        current.map((message) => (message.id === assistant.id ? { ...message, content: safeAnswer } : message)),
      );
      inputRef.current?.focus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to get an answer.");
      setMessages((current) => current.filter((message) => message.id !== assistant.id));
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  if (loading)
    return (
      <Wrapper>
        <div className="grid flex-1 place-items-center py-20">
          <LoaderCircle className="size-6 animate-spin text-violet-400" />
        </div>
      </Wrapper>
    );

  if (!repositoryId)
    return (
      <Wrapper>
        <div className="grid flex-1 place-items-center px-5 text-center py-20">
          <p className="max-w-md text-sm text-zinc-400">
            Open this page from a repository detail page or add <code className="rounded bg-zinc-900 px-1 py-0.5 text-xs text-violet-300">?repository=&lt;id&gt;</code> to the URL.
          </p>
          <a className="mt-4 inline-block text-sm text-violet-300 hover:text-violet-200" href="/">
            Import a repository
          </a>
        </div>
      </Wrapper>
    );

  if (error && !context)
    return (
      <Wrapper>
        <div className="grid flex-1 place-items-center px-5 text-center py-20">
          <p className="max-w-md text-sm text-zinc-400">{error}</p>
          <a className="mt-4 text-sm text-violet-300 hover:text-violet-200" href="/">
            Import a repository
          </a>
        </div>
      </Wrapper>
    );

  return (
    <Wrapper>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-0 pb-6 pt-6 sm:px-0 sm:pb-8">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-16">
              <div className="grid size-11 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
                <Bot className="size-5" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">What do you want to understand?</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                Ask about architecture, authentication, state, payments, or any code path in {context?.repository.name}.
              </p>
              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-xl border border-white/[.08] bg-white/[.025] p-3 text-left text-sm text-zinc-300 transition hover:border-violet-400/30 hover:bg-violet-400/[.06]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-7">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-violet-500 px-4 py-3 text-sm text-white"
                      : "max-w-2xl rounded-3xl border border-white/[.06] bg-zinc-950/70 p-4 text-sm leading-7 text-zinc-300"
                  }
                >
                  {message.role === "assistant" && (
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-300">
                      <Sparkles className="size-3.5" /> GitLens AI
                    </p>
                  )}
                  {message.content ? (
                    message.role === "assistant" ? (
                      <MarkdownMessage>{message.content}</MarkdownMessage>
                    ) : (
                      message.content
                    )
                  ) : (
                    <LoaderCircle className="size-4 animate-spin text-violet-300" />
                  )}
                </article>
              ))}
            </div>
          )}
        </AnimatePresence>

        {error && (
          <p className="mt-5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="mx-auto w-full max-w-3xl px-0 pb-6 sm:px-0">
        <div className="flex items-end gap-2 rounded-2xl border border-white/[.1] bg-zinc-900 p-3 shadow-xl shadow-black/20">
          <textarea
            ref={inputRef}
            autoFocus
            spellCheck={false}
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask about the repo architecture, file roles, or a specific code path..."
            className="min-h-[80px] flex-1 resize-none rounded-2xl bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            aria-label="Repository chat input"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500 text-white transition disabled:opacity-50"
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </Wrapper>
  );
}

function ChatShell({ children, header = "Repository chat" }: { children: React.ReactNode; header?: string }) {
  return (
    <main className="flex h-screen flex-col bg-zinc-950">
      <header className="flex h-16 shrink-0 items-center border-b border-white/[.06] px-5 sm:px-8">
        <a href="/" className="mr-4 rounded-md p-1.5 text-zinc-500 hover:bg-white/[.05] hover:text-white" aria-label="Back to home">
          <ArrowLeft className="size-4" />
        </a>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{header}</p>
          <p className="text-xs text-zinc-500">Repository context is active</p>
        </div>
        <FileCode2 className="ml-auto size-4 text-violet-400" />
      </header>
      {children}
    </main>
  );
}
