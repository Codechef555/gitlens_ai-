import { NextResponse } from "next/server";
import { generateRepositoryDocumentation, analyzeRepositoryRisks } from "@/services/repository-risk.server";
import { getRepositoryContext } from "@/services/repository-context-store.server";

export async function GET(_: Request, { params }: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await params;
  const context = await getRepositoryContext(repositoryId);
  if (!context) return NextResponse.json({ error: "Repository context not found." }, { status: 404 });
  const risks = analyzeRepositoryRisks(context);
  return NextResponse.json({ risks, documentation: generateRepositoryDocumentation(context, risks) });
}
