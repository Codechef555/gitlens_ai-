import { notFound } from "next/navigation";

import { RepositoryWorkspace } from "@/features/repository-workspace/components/repository-workspace";
import { getRepositoryContext } from "@/services/repository-context-store.server";

export default async function RepositoryPage({ params }: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await params;
  const context = await getRepositoryContext(repositoryId);
  if (!context) notFound();
  return <RepositoryWorkspace context={context}/>;
}
