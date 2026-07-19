import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, relative } from "node:path";

import type { ArchitectureEdge, ArchitectureNode, DependencyEdge, RepositoryAnalysis, RepositoryFile, RepositoryModule } from "@/types/repository";

const IGNORE = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo"]);
const EXTENSIONS: Record<string, string> = { ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".py": "Python", ".go": "Go", ".rs": "Rust", ".java": "Java", ".rb": "Ruby", ".php": "PHP", ".cs": "C#", ".swift": "Swift", ".kt": "Kotlin", ".vue": "Vue", ".css": "CSS", ".scss": "SCSS", ".html": "HTML", ".sql": "SQL" };
const TEXT_EXTENSIONS = new Set([...Object.keys(EXTENSIONS), ".json", ".yml", ".yaml", ".md", ".env", ".toml", ".prisma"]);
const MAX_FILES = 750;
const MAX_PREVIEW_BYTES = 12_000;

async function collectFiles(directory: string, root = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(absolute, root));
    else if (entry.isFile()) result.push(relative(root, absolute).replaceAll("\\", "/"));
    if (result.length > MAX_FILES) throw new Error("This repository has too many files for the current analysis limit.");
  }
  return result;
}

function detectFrameworks(paths: string[], previews: Map<string, string>) {
  const has = (name: string) => paths.some((path) => path.endsWith(name));
  const packageJson = [...previews.entries()].find(([path]) => path.endsWith("package.json"))?.[1] ?? "";
  const frameworks = [
    ["Next.js", /"next"\s*:/], ["React", /"react"\s*:/], ["Vue", /"vue"\s*:/], ["Svelte", /"svelte"\s*:/], ["Express", /"express"\s*:/], ["NestJS", /"@nestjs/], ["FastAPI", /fastapi/i], ["Django", /django/i], ["Laravel", /laravel/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(packageJson) || [...previews.values()].some((preview) => (pattern as RegExp).test(preview))).map(([name]) => name as string);
  if (has("go.mod")) frameworks.push("Go modules"); if (has("Cargo.toml")) frameworks.push("Rust Cargo"); if (has("prisma/schema.prisma")) frameworks.push("Prisma");
  return [...new Set(frameworks)];
}

function identifyModules(paths: string[]): RepositoryModule[] {
  const rules: Array<[RepositoryModule["kind"], RegExp, string]> = [["authentication", /auth|login|session|jwt|identity/i, "Authentication"], ["database", /database|db|prisma|models|migrations|repository/i, "Database"], ["api", /(^|\/)(api|routes?|controllers?)(\/|$)/i, "API"], ["configuration", /config|settings|\.env|next\.config|vite\.config/i, "Configuration"]];
  const modules = rules.map(([kind, pattern, name]) => ({ kind, name, files: paths.filter((path) => pattern.test(path)).slice(0, 40) })).filter((module) => module.files.length);
  const shared = paths.filter((path) => /(^|\/)(components|lib|utils|shared)(\/|$)/i.test(path)).slice(0, 40);
  if (shared.length) modules.push({ kind: "shared", name: "Shared building blocks", files: shared });
  const features = paths.filter((path) => /(^|\/)(features|modules|domains)(\/|$)/i.test(path)).slice(0, 40);
  if (features.length) modules.push({ kind: "feature", name: "Feature modules", files: features });
  if (!modules.length) {
    const folders = new Map<string, string[]>();
    paths.forEach((path) => { const folder = path.split("/")[0] || "root"; folders.set(folder, [...(folders.get(folder) ?? []), path]); });
    [...folders.entries()].slice(0, 6).forEach(([folder, files], index) => modules.push({ kind: (["feature", "shared", "api", "configuration", "database", "authentication"] as const)[index % 6], name: `${folder} module`, files: files.slice(0, 40) }));
  }
  return modules;
}

function resolveImport(from: string, specifier: string, available: Set<string>) {
  if (!specifier.startsWith(".")) return null;
  const base = normalize(join(dirname(from), specifier)).replaceAll("\\", "/");
  const candidates = [base, ...Object.keys(EXTENSIONS).map((extension) => `${base}${extension}`), ...Object.keys(EXTENSIONS).map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => available.has(candidate)) ?? null;
}

function findDependencies(files: RepositoryFile[]) {
  const available = new Set(files.map((file) => file.path)); const dependencies: DependencyEdge[] = [];
  for (const file of files) {
    if (!file.preview) continue;
    const expression = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+(?:[^'";]+?\s+from\s+)?|require\s*\()['"]([^'"]+)['"]\)?/g;
    for (const match of file.preview.matchAll(expression)) { const target = resolveImport(file.path, match[1], available); if (target) dependencies.push({ source: file.path, target, kind: match[0].startsWith("require") ? "require" : "import" }); }
  }
  return dependencies.filter((edge, index, edges) => edges.findIndex((candidate) => candidate.source === edge.source && candidate.target === edge.target) === index);
}

function findCircularDependencies(edges: DependencyEdge[]) {
  const graph = new Map<string, string[]>(); edges.forEach(({ source, target }) => graph.set(source, [...(graph.get(source) ?? []), target])); const cycles: string[][] = []; const visiting = new Set<string>(); const visited = new Set<string>();
  function walk(node: string, trail: string[]) { if (visiting.has(node)) { const cycle = trail.slice(trail.indexOf(node)); if (cycle.length > 1 && !cycles.some((existing) => existing.join("|") === cycle.join("|"))) cycles.push(cycle); return; } if (visited.has(node)) return; visiting.add(node); for (const target of graph.get(node) ?? []) walk(target, [...trail, target]); visiting.delete(node); visited.add(node); }
  [...graph.keys()].forEach((node) => walk(node, [node])); return cycles;
}

function buildArchitecture(modules: RepositoryModule[], edges: DependencyEdge[]) {
  const nodes: ArchitectureNode[] = modules.map((module) => ({ id: module.kind, label: module.name, kind: module.kind, files: module.files })); const owner = new Map<string, string>(); modules.forEach((module) => module.files.forEach((file) => owner.set(file, module.kind))); const counts = new Map<string, number>();
  edges.forEach(({ source, target }) => { const from = owner.get(source); const to = owner.get(target); if (from && to && from !== to) { const key = `${from}|${to}`; counts.set(key, (counts.get(key) ?? 0) + 1); } });
  const architectureEdges: ArchitectureEdge[] = [...counts.entries()].map(([key, count]) => { const [source, target] = key.split("|"); return { source, target, relationship: `${count} imports` }; }); return { nodes, edges: architectureEdges };
}

export async function analyzeRepository(directory: string): Promise<{ analysis: RepositoryAnalysis; files: RepositoryFile[] }> {
  const fileTree = await collectFiles(directory);
  const previews = new Map<string, string>();
  const files = await Promise.all(fileTree.map(async (path) => {
    const absolute = join(directory, path); const details = await stat(absolute); const extension = extname(path).toLowerCase();
    let preview: string | undefined;
    if (TEXT_EXTENSIONS.has(extension) || path.endsWith("package.json") || path.endsWith("README.md")) preview = (await readFile(absolute, "utf8")).slice(0, MAX_PREVIEW_BYTES);
    if (preview) previews.set(path, preview);
    return { path, language: EXTENSIONS[extension] ?? "Other", size: details.size, preview };
  }));
  const languageCounts = files.reduce((counts, file) => { if (file.language !== "Other") counts.set(file.language, (counts.get(file.language) ?? 0) + 1); return counts; }, new Map<string, number>());
  const languages = [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, files]) => ({ name, files }));
  const frameworks = detectFrameworks(fileTree, previews);
  const modules = identifyModules(fileTree);
  const dependencies = findDependencies(files); const circularDependencies = findCircularDependencies(dependencies); const circularEdges = new Set(circularDependencies.flatMap((cycle) => cycle.slice(0, -1).map((node, index) => `${node}|${cycle[index + 1]}`)));
  dependencies.forEach((edge) => { edge.circular = circularEdges.has(`${edge.source}|${edge.target}`); });
  const architecture = buildArchitecture(modules, dependencies);
  const summary = `${fileTree.length} files across ${languages.slice(0, 3).map((language) => language.name).join(", ") || "mixed technologies"}${frameworks.length ? `, using ${frameworks.join(" and ")}` : ""}. ${modules.length ? `Key areas include ${modules.map((module) => module.name.toLowerCase()).join(", ")}.` : ""}`;
  return { analysis: { fileTree, languages, frameworks, modules, dependencies, circularDependencies, architecture, summary }, files };
}
