"use client";

import { useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { Search, TriangleAlert } from "lucide-react";

import type { RepositoryContext } from "@/types/repository";

export function DependencyGraph({ context }: { context: RepositoryContext }) {
  const [search, setSearch] = useState("");
  const [onlyCircular, setOnlyCircular] = useState(false);
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const incoming = useMemo(() => new Set(context.analysis.dependencies.map((edge) => edge.target)), [context]);

  const visibleFiles = useMemo(
    () =>
      context.files.filter((file) => {
        const matchesSearch = !search || file.path.toLowerCase().includes(search.toLowerCase());
        const matchesCircular = !onlyCircular || context.analysis.dependencies.some((edge) => edge.circular && (edge.source === file.path || edge.target === file.path));
        const matchesUnused = !onlyUnused || !incoming.has(file.path);
        return matchesSearch && matchesCircular && matchesUnused;
      }),
    [context, incoming, onlyCircular, onlyUnused, search],
  );

  const allowed = useMemo(() => new Set(visibleFiles.map((file) => file.path)), [visibleFiles]);

  const nodes = useMemo(
    () =>
      visibleFiles.map((file, index): Node => ({
        id: file.path,
        position: { x: (index % 6) * 240 + 40, y: Math.floor(index / 6) * 140 + 40 },
        data: {
          label: (
            <div>
              <p className="max-w-[12rem] truncate font-mono text-[10px] text-zinc-200">{file.path.split("/").at(-1)}</p>
              <p className="mt-1 text-[9px] text-zinc-500">{file.language}</p>
            </div>
          ),
        },
        style: {
          width: 210,
          borderRadius: 12,
          border: selected === file.path ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,.12)",
          background: !incoming.has(file.path) ? "rgba(251,191,36,.12)" : "#18181b",
          padding: "10px 12px",
        },
      })),
    [incoming, selected, visibleFiles],
  );

  const edges = useMemo(
    () =>
      context.analysis.dependencies
        .filter((edge) => allowed.has(edge.source) && allowed.has(edge.target))
        .map((edge): Edge => ({
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          animated: edge.circular,
          style: {
            stroke: edge.circular ? "#fb7185" : "#52525b",
            strokeWidth: edge.circular ? 1.5 : 1,
          },
        })),
    [allowed, context],
  );

  const selectedFile = context.files.find((file) => file.path === selected);

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="h-[760px] overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900/50">
        <div className="flex flex-col gap-3 border-b border-white/[.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Dependency map</p>
              <p className="mt-1 text-xs text-zinc-500">Files are nodes, imports are edges. Filters help you focus on hot spots.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1">Search</span>
              <span className="rounded-full bg-amber-400/10 px-2.5 py-1">Circular</span>
              <span className="rounded-full bg-sky-400/10 px-2.5 py-1">Unused</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-white/[.08] bg-zinc-950 px-3">
              <Search className="size-4 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search files…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>
            <Filter active={onlyCircular} onClick={() => setOnlyCircular(!onlyCircular)} label="Circular" />
            <Filter active={onlyUnused} onClick={() => setOnlyUnused(!onlyUnused)} label="Unused" />
          </div>
        </div>

        <div className="h-[calc(100%-84px)]">
          {nodes.length ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              minZoom={0.08}
              maxZoom={1.5}
              onNodeClick={(_, node) => setSelected(node.id)}
              style={{ width: "100%", height: "100%" }}
            >
              <Background color="#3f3f46" gap={18} size={1} />
              <Controls />
              <MiniMap
                maskColor="rgba(9,9,11,.75)"
                nodeColor={(node) => (node.id === selected ? "#a78bfa" : "#52525b")}
              />
            </ReactFlow>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="rounded-3xl border border-white/[.08] bg-zinc-950/60 p-8">
                <p className="text-sm font-semibold text-white">No dependency nodes matched the filters.</p>
                <p className="mt-2 text-sm text-zinc-400">Adjust the search or toggle circular/unused filters to restore the graph.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5">
        <p className="text-xs font-semibold tracking-[.14em] text-violet-400">DEPENDENCY EXPLORER</p>
        {selectedFile ? (
          <>
            <h3 className="mt-3 break-all font-mono text-sm font-medium text-white">{selectedFile.path}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">This file connects the repository through imports and reverse imports. Use the graph to trace dependency flow.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <Stat label="Imports" value={context.analysis.dependencies.filter((edge) => edge.source === selectedFile.path).length} />
              <Stat label="Imported by" value={context.analysis.dependencies.filter((edge) => edge.target === selectedFile.path).length} />
            </div>
            <p className="mt-5 text-xs font-medium text-zinc-500">File preview</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 text-[10px] leading-5 text-zinc-400">
              {selectedFile.preview?.slice(0, 1400) ?? "Preview unavailable for this file."}
            </pre>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Every analyzed file is a node. Select one to inspect its imports, callers, and source excerpt.</p>
            <div className="mt-6 space-y-3">
              <Alert label="Circular imports" value={context.analysis.circularDependencies.length} />
              <Alert label="Likely unused modules" value={context.files.filter((file) => !incoming.has(file.path)).length} />
              <Alert label="Visible files" value={visibleFiles.length} />
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

function Filter({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-lg border px-3 text-xs transition ${
        active ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/[.08] text-zinc-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-950 p-2">
      <p className="text-base font-medium text-white">{value}</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

function Alert({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[.06] bg-zinc-950/60 px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-zinc-400">
        <TriangleAlert className="size-3.5 text-amber-400" />
        {label}
      </span>
      <span className="font-medium text-zinc-200">{value}</span>
    </div>
  );
}
