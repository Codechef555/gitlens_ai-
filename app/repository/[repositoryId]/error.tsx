"use client";

export default function RepositoryError({ reset }: { reset: () => void }) { return <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 text-center"><div><h1 className="text-xl font-semibold text-white">Workspace unavailable</h1><p className="mt-3 text-sm text-zinc-400">The repository workspace could not be rendered.</p><button onClick={reset} className="mt-5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white">Try again</button></div></main>; }
