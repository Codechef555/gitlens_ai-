import { NextResponse } from "next/server";

import { cloneGitHubRepository, inspectZipRepository } from "@/services/repository-import.server";
import type { RepositoryImportResult } from "@/types/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const source = formData.get("source");
    const context = source === "github"
      ? await cloneGitHubRepository(String(formData.get("url") ?? ""))
      : source === "zip" && formData.get("file") instanceof File
        ? await inspectZipRepository(formData.get("file") as File)
        : null;
    if (!context) throw new Error("Choose a GitHub repository or ZIP file to import.");
    return NextResponse.json<RepositoryImportResult>({ success: true, repository: context.repository });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while importing the repository.";
    return NextResponse.json<RepositoryImportResult>({ success: false, error: message }, { status: 400 });
  }
}
