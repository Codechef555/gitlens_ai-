"use client";

import { useState } from "react";
import { Boxes, GitFork, MessageSquareText, Network, PanelTop, ShieldAlert } from "lucide-react";

import { ArchitectureVisualization } from "@/features/architecture/components/architecture-visualization";
import { ChangeImpactSimulator } from "@/features/change-impact/components/change-impact-simulator";
import { DependencyGraph } from "@/features/dependencies/components/dependency-graph";
import { RepositoryChat } from "@/features/ai-chat/components/repository-chat";
import { RiskAnalyzer } from "@/features/risk-analyzer/components/risk-analyzer";
import type { RepositoryContext } from "@/types/repository";

type Tab = "architecture" | "dependencies" | "impact" | "risks" | "chat";
const tabs: { id: Tab; label: string; icon: typeof Network }[] = [{ id: "architecture", label: "Architecture", icon: PanelTop }, { id: "dependencies", label: "Dependencies", icon: Network }, { id: "impact", label: "Change impact", icon: GitFork }, { id: "risks", label: "Risks & docs", icon: ShieldAlert }, { id: "chat", label: "Chat", icon: MessageSquareText }];

export function RepositoryWorkspace({ context }: { context: RepositoryContext }) {
  const [tab, setTab] = useState<Tab>("architecture");
  return <main className="min-h-screen bg-zinc-950"><header className="border-b border-white/[.06] bg-zinc-950/80 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-5 sm:px-8"><a href="/" className="flex items-center gap-2 font-semibold text-white"><span className="grid size-7 place-items-center rounded-md bg-violet-500"><Boxes className="size-3.5"/></span>GitLens AI</a><span className="h-5 w-px bg-white/[.1]"/><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-200">{context.repository.name}</p><p className="text-[10px] text-zinc-500">{context.repository.primaryLanguage} Â· {context.repository.fileCount.toLocaleString()} files</p></div><a href={`/chat?repository=${context.repository.id}`} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/[.1] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[.05]"><MessageSquareText className="size-3.5"/> Chat</a></div></header><div className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.14em] text-violet-400">REPOSITORY INTELLIGENCE</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Build from a shared mental model.</h1></div><div className="flex rounded-xl border border-white/[.08] bg-zinc-900 p-1">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition sm:px-4 ${tab === item.id ? "bg-white/[.09] text-white" : "text-zinc-500 hover:text-zinc-300"}`}><Icon className="size-3.5"/>{item.label}</button>; })}</div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">{context.analysis.summary}</p><div className="mt-7">{tab === "architecture" && <ArchitectureVisualization context={context}/>} {tab === "dependencies" && <DependencyGraph context={context}/>} {tab === "impact" && <ChangeImpactSimulator repositoryId={context.repository.id}/>} {tab === "risks" && <RiskAnalyzer repositoryId={context.repository.id}/>} {tab === "chat" && <RepositoryChat repositoryId={context.repository.id} embedded />}</div></div></main>;
}
