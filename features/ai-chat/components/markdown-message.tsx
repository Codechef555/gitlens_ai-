"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: ({ className, children, ...props }) => <code className={`${className ?? ""} rounded bg-white/[.08] px-1 py-0.5 text-[.9em] text-violet-200`} {...props}>{children}</code>, pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-xl border border-white/[.08] bg-zinc-950 p-4 text-sm leading-6">{children}</pre> }}>{children}</ReactMarkdown>;
}
