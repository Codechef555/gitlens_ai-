import { NextResponse } from "next/server";

import { simulateChangeImpact, getImpactHistory } from "@/services/change-impact.server";
import { getRepositoryContext } from "@/services/repository-context-store.server";

export async function GET(_: Request, { params }: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await params;
  return NextResponse.json(getImpactHistory(repositoryId));
}

export async function POST(request: Request, { params }: { params: Promise<{ repositoryId: string }> }) {
  try {
    const { repositoryId } = await params;
    const context = await getRepositoryContext(repositoryId);
    if (!context) throw new Error("Repository context was not found. Import the repository again.");
    const { query } = await request.json();
    if (typeof query !== "string" || query.trim().length < 4) throw new Error("Describe the change you want to simulate.");
    return NextResponse.json(simulateChangeImpact(context, query.trim()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to simulate this change." }, { status: 400 });
  }
}
