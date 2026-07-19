"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 text-center"><div><p className="text-sm font-medium text-violet-300">Something went wrong</p><h1 className="mt-2 text-2xl font-semibold text-white">GitLens could not load this view.</h1><p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">Try again, or return to import a repository if the issue persists.</p><div className="mt-6 flex justify-center gap-3"><button onClick={reset} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400">Try again</button><a href="/" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[.05]">Home</a></div></div></main>;
}
