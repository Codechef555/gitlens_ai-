"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FileArchive, Github, LoaderCircle, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RepositoryImportResult, RepositoryMetadata } from "@/types/repository";

type ImportStage = "idle" | "validating" | "cloning" | "complete" | "error";
const stageLabel: Record<Exclude<ImportStage, "idle" | "error">, string> = { validating: "Validating repository", cloning: "Cloning repository", complete: "Repository ready" };

export function ImportRepositoryDialog() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"github" | "zip">("github");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [repository, setRepository] = useState<RepositoryMetadata | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() { setStage("idle"); setError(null); setRepository(null); }
  function close() { setOpen(false); reset(); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (source === "github" && !url.trim()) { setError("Paste a GitHub repository URL to continue."); return; }
    if (source === "zip" && !file) { setError("Choose a ZIP file to continue."); return; }
    setError(null); setStage("validating");
    const formData = new FormData(); formData.set("source", source);
    if (source === "github") { formData.set("url", url.trim()); setTimeout(() => setStage("cloning"), 700); }
    if (source === "zip" && file) formData.set("file", file);
    try {
      const response = await fetch("/api/repositories/import", { method: "POST", body: formData });
      const result = await response.json() as RepositoryImportResult;
      if (!response.ok || !result.success) throw new Error(result.success ? "Unable to import this repository." : result.error);
      setRepository(result.repository); setStage("complete");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to import this repository."); setStage("error"); }
  }

  const isWorking = stage === "validating" || stage === "cloning";
  return <>
    <Button size="lg" onClick={() => setOpen(true)} className="bg-slate-100 text-slate-900 hover:bg-slate-200">Import repository <Upload className="size-4" /></Button>
    <AnimatePresence>{open && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="import-title" className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-black/40 ring-1 ring-white/5" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.24em] text-sky-400">Repository import</p><h2 id="import-title" className="mt-3 text-2xl font-semibold text-slate-100">Bring your codebase into focus.</h2></div><button onClick={close} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close import dialog"><X className="size-5" /></button></div>
        {stage === "complete" && repository ? <ImportSuccess repository={repository} onClose={close} /> : <form onSubmit={submit} className="mt-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-800/90 p-1">
            <SourceTab active={source === "github"} onClick={() => { setSource("github"); reset(); }} icon={<Github className="size-4" />} label="GitHub URL" />
            <SourceTab active={source === "zip"} onClick={() => { setSource("zip"); reset(); }} icon={<FileArchive className="size-4" />} label="ZIP upload" />
          </div>
          <div className="mt-5">{source === "github" ? <label className="block text-sm font-medium text-slate-200">Repository URL<input value={url} disabled={isWorking} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></label> : <button type="button" disabled={isWorking} onClick={() => fileInput.current?.click()} className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-5 text-center transition hover:border-sky-400/70 hover:bg-slate-900"><Upload className="size-5 text-sky-400" /><span className="mt-3 text-sm font-medium text-slate-100">{file ? file.name : "Choose a repository ZIP"}</span><span className="mt-2 text-xs text-slate-500">Maximum size: 50 MB</span><input ref={fileInput} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} /></button>}</div>
          {(isWorking || stage === "error") && <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300"><div className="flex items-center gap-2">{isWorking ? <LoaderCircle className="size-4 animate-spin text-sky-400" /> : <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />}{isWorking ? stageLabel[stage] : error}</div>{isWorking && <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800"><motion.div className="h-full rounded-full bg-sky-400" initial={{ width: "8%" }} animate={{ width: stage === "cloning" ? "72%" : "38%" }} transition={{ duration: 0.5 }} /></div>}</div>}
          <p className="mt-4 text-xs leading-5 text-slate-500">GitLens reads public repositories and validates ZIP structure. Your source stays private to your workspace.</p>
          <Button type="submit" size="lg" disabled={isWorking} className="mt-5 w-full bg-slate-100 text-slate-900 hover:bg-slate-200">{isWorking ? "Preparing repository…" : "Import repository"}{!isWorking && <Upload className="size-4" />}</Button>
        </form>}
      </motion.section>
    </motion.div>}</AnimatePresence>
  </>;
}

function SourceTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex h-9 items-center justify-center gap-2 rounded-lg text-sm transition ${active ? "bg-white/[0.08] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>{icon}{label}</button>; }

function ImportSuccess({ repository, onClose }: { repository: RepositoryMetadata; onClose: () => void }) { return <div className="mt-7 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-400" /><h3 className="mt-3 text-lg font-semibold text-white">{repository.name} is ready</h3><p className="mt-1 text-sm text-zinc-400">Validated and prepared for repository intelligence.</p><div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl border border-white/[0.08] bg-zinc-950/70 py-3 text-center"><Metric label="Files" value={repository.fileCount.toLocaleString()} /><Metric label="Language" value={repository.primaryLanguage} /><Metric label="Size" value={repository.sizeLabel} /></div><Button asChild size="lg" className="mt-6 w-full bg-violet-500 text-white hover:bg-violet-400"><a href={`/repository/${repository.id}`}>Open workspace</a></Button><button onClick={onClose} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300">Close</button></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="px-2"><p className="truncate text-sm font-medium text-zinc-100">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</p></div>; }
