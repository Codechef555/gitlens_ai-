"use client";

import { useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { Boxes, Database, KeyRound, Layers3, Settings2, Waypoints } from "lucide-react";

import type { ArchitectureNode, RepositoryContext } from "@/types/repository";

const iconByKind = {
  authentication: KeyRound,
  database: Database,
  api: Waypoints,
  configuration: Settings2,
  feature: Layers3,
  shared: Boxes,
};

const colorByKind = {
  authentication: "#a78bfa",
  database: "#34d399",
  api: "#60a5fa",
  configuration: "#fbbf24",
  feature: "#f472b6",
  shared: "#94a3b8",
};

export function ArchitectureVisualization({ context }: { context: RepositoryContext }) {
  const [selected, setSelected] = useState<ArchitectureNode | null>(null);
  const { nodes, edges } = useMemo(
    () => ({
      nodes: context.analysis.architecture.nodes.map((node, index): Node => ({
        id: node.id,
        position: { x: (index % 4) * 260 + 40, y: Math.floor(index / 4) * 185 + 40 },
        data: { label: <ArchitectureCard node={node} /> },
        style: { border: "none", background: "transparent", width: 215 },
      })),
      edges: context.analysis.architecture.edges.map((edge, index): Edge => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.relationship,
        animated: index % 2 === 0,
        style: { stroke: "#6d5dfc", strokeOpacity: 0.75, strokeWidth: 1.2 },
        labelStyle: { fill: "#a1a1aa", fontSize: 10 },
      })),
    }),
    [context],
  );

  const selectedNode = selected
    ? context.analysis.architecture.nodes.find((item) => item.id === selected.id) ?? selected
    : null;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_360px]">
      <div className="h-[760px] overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900/55 shadow-glow">
        <div className="flex flex-col gap-3 border-b border-white/[.06] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">System architecture</p>
              <p className="mt-1 text-xs text-zinc-500">{nodes.length} domains · {edges.length} relationships</p>
            </div>
            <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">Topology view</span>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            This map visualizes inferred application domains and how they depend on one another. Each node groups related repository files and shows dependency flow across the system.
          </p>
        </div>

        <div className="h-[calc(100%-108px)]">
          {nodes.length ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              minZoom={0.3}
              onNodeClick={(_, node) => setSelected(context.analysis.architecture.nodes.find((item) => item.id === node.id) ?? null)}
              style={{ width: "100%", height: "100%" }}
            >
              <Background color="#3f3f46" gap={18} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(node) =>
                  colorByKind[(context.analysis.architecture.nodes.find((item) => item.id === node.id)?.kind ?? "shared")]
                }
                maskColor="rgba(9,9,11,.72)"
              />
            </ReactFlow>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="rounded-3xl border border-white/[.08] bg-zinc-950/60 p-8">
                <p className="text-sm font-semibold text-white">No architecture graph was detected.</p>
                <p className="mt-2 text-sm text-zinc-400">
                  This repository did not include enough inferred module boundaries to render a topology. Use the dependencies view for file-level detail.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5">
        <p className="text-xs font-semibold tracking-[.14em] text-violet-400">ARCHITECTURE SUMMARY</p>
        <h3 className="mt-3 text-lg font-semibold text-white">{selectedNode?.label ?? "Topology overview"}</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {selectedNode
            ? `${selectedNode.files.length} files are grouped in this domain. Select a node to inspect its scope.`
            : "Explore the inferred domains to understand the repository topology and how blocks of functionality depend on each other."}
        </p>

        <div className="mt-5 grid gap-3">
          <Stat label="Detected domains" value={nodes.length} />
          <Stat label="Dependency links" value={edges.length} />
          <Stat label="Detected stack" value={context.analysis.frameworks.length ? context.analysis.frameworks.join(", ") : "Not detected"} />
        </div>

        {selectedNode ? (
          <div className="mt-6">
            <p className="text-xs font-medium text-zinc-500">Representative files</p>
            <div className="mt-2 space-y-2">
              {selectedNode.files.slice(0, 6).map((file) => (
                <p key={file} className="truncate rounded-md bg-zinc-950/70 px-2 py-1.5 font-mono text-[11px] text-zinc-400">
                  {file}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-white/[.07] bg-zinc-950/65 p-4">
            <p className="text-sm text-zinc-300">Click a domain node to see its scope, representative files, and dependency role.</p>
          </div>
        )}
      </aside>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-zinc-950/70 p-3">
      <p className="text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

function ArchitectureCard({ node }: { node: ArchitectureNode }) {
  const Icon = iconByKind[node.kind];
  return (
    <div className="rounded-2xl border border-white/[.12] bg-zinc-900 px-3 py-3 shadow-lg shadow-black/20">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md" style={{ backgroundColor: `${colorByKind[node.kind]}22`, color: colorByKind[node.kind] }}>
          <Icon className="size-3.5" />
        </span>
        <p className="truncate text-xs font-medium text-zinc-100">{node.label}</p>
      </div>
      <p className="mt-2 text-[10px] text-zinc-500">{node.files.length} files</p>
    </div>
  );
}
