import { NextResponse } from "next/server";

import { getRepositoryContext } from "@/services/repository-context-store.server";

export async function GET(_: Request, { params }: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await params;
  const context = await getRepositoryContext(repositoryId);
  if (!context) return NextResponse.json({ error: "Repository context was not found. Import the repository again to start a chat." }, { status: 404 });
  return NextResponse.json(context);
}
