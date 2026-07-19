import { RepositoryChat } from "@/features/ai-chat/components/repository-chat";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ repository?: string }> }) {
  const { repository } = await searchParams;
  const repositoryId = typeof repository === "string" ? repository : "";
  return <RepositoryChat repositoryId={repositoryId} />;
}
