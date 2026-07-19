import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, dirname, extname, normalize, relative, resolve, isAbsolute } from "node:path";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";

import { analyzeRepository } from "@/services/repository-analysis.server";
import { saveRepositoryContext } from "@/services/repository-context-store.server";
import type { RepositoryContext, RepositoryMetadata } from "@/types/repository";

const execFileAsync = promisify(execFile);
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10_000;
const languageByExtension: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
  ".py": "Python", ".go": "Go", ".rs": "Rust", ".java": "Java", ".rb": "Ruby",
  ".php": "PHP", ".cs": "C#", ".swift": "Swift", ".kt": "Kotlin", ".vue": "Vue",
};

export function validateGitHubUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid GitHub repository URL."); }
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public github.com repository URLs are supported.");
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/");
  if (parts.length !== 2 || !parts.every(Boolean)) throw new Error("Use a repository URL such as https://github.com/owner/repository.");
  return new URL(`https://github.com/${parts[0]}/${parts[1]}.git`);
}

function primaryLanguage(paths: string[]) {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const language = languageByExtension[extname(path).toLowerCase()];
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

async function scanDirectory(directory: string, root = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await scanDirectory(absolute, root));
    else if (entry.isFile()) paths.push(absolute.slice(root.length + 1));
    if (paths.length > MAX_FILES) throw new Error("This repository is too large to import.");
  }
  return paths;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchGitHubDefaultBranch(owner: string, repo: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "GitLens AI Importer",
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.default_branch === "string" ? data.default_branch : null;
  } catch {
    return null;
  }
}

function githubArchiveUrl(owner: string, repo: string, branch: string) {
  return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
}

async function downloadGitHubArchive(owner: string, repo: string, branch: string) {
  const archiveUrl = githubArchiveUrl(owner, repo, branch);
  const response = await fetch(archiveUrl, {
    headers: {
      Accept: "application/zip",
      "User-Agent": "GitLens AI Importer",
    },
  });
  if (!response.ok) throw new Error(`Unable to download the repository archive from branch ${branch}.`);
  return new Uint8Array(await response.arrayBuffer());
}

async function resolveGitHubArchive(owner: string, repo: string) {
  const defaultBranch = await fetchGitHubDefaultBranch(owner, repo);
  const branches = [...new Set([defaultBranch, "main", "master"].filter((value): value is string => Boolean(value)))];
  let lastError: Error | null = null;
  for (const branch of branches) {
    try {
      return { bytes: await downloadGitHubArchive(owner, repo, branch), branch };
    } catch (error) {
      if (error instanceof Error) lastError = error;
    }
  }
  throw lastError ?? new Error("Unable to download the repository archive.");
}

export async function cloneGitHubRepository(urlValue: string): Promise<RepositoryContext> {
  const cloneUrl = validateGitHubUrl(urlValue);
  const [owner, repo] = cloneUrl.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/");
  if (!owner || !repo) throw new Error("Use a repository URL such as https://github.com/owner/repository.");
  const tempRoot = await mkdtemp(join(tmpdir(), "gitlens-"));
  let checkout = join(tempRoot, "repository");
  try {
    const { bytes, branch } = await resolveGitHubArchive(owner, repo);
    await mkdir(checkout, { recursive: true });
    const entries = readZipEntries(bytes);
    await extractZip(bytes, checkout, entries);

    const extractedEntries = await readdir(checkout, { withFileTypes: true });
    const topLevelDirs = extractedEntries.filter((entry) => entry.isDirectory() && entry.name !== "__MACOSX");
    if (topLevelDirs.length === 1) {
      checkout = join(checkout, topLevelDirs[0].name);
    }

    const paths = await scanDirectory(checkout);
    const repositoryName = basename(cloneUrl.pathname, ".git");
    const metadata: RepositoryMetadata = {
      id: crypto.randomUUID(),
      name: repositoryName,
      source: "github",
      url: cloneUrl.href.replace(/\.git$/, ""),
      fileCount: paths.length,
      primaryLanguage: primaryLanguage(paths),
      defaultBranch: branch,
      sizeLabel: `${paths.length.toLocaleString()} files`,
    };
    const { analysis, files } = await analyzeRepository(checkout);
    return saveRepositoryContext({ repository: metadata, analysis, files, createdAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clone this repository.";
    if (/not found|repository.*not found|authentication/i.test(message)) throw new Error("We could not access that public repository. Check the URL and try again.");
    if (/timed out/i.test(message)) throw new Error("Cloning took too long. Try a smaller repository.");
    throw new Error(message.includes("archive") ? message : "Unable to clone this repository. Please try again.");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

type ZipEntry = { path: string; compression: number; compressedSize: number; uncompressedSize: number; localOffset: number };

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];
  for (let offset = 0; offset <= bytes.byteLength - 46; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const end = offset + 46 + nameLength;
    if (end > bytes.byteLength) break;
    const path = new TextDecoder().decode(bytes.slice(offset + 46, end));
    if (path && !path.endsWith("/")) entries.push({ path, compression: view.getUint16(offset + 10, true), compressedSize: view.getUint32(offset + 20, true), uncompressedSize: view.getUint32(offset + 24, true), localOffset: view.getUint32(offset + 42, true) });
    if (entries.length > MAX_FILES) throw new Error("This ZIP contains too many files to import.");
    offset += 46 + nameLength + extraLength + commentLength - 1;
  }
  return entries;
}

async function extractZip(bytes: Uint8Array, destination: string, entries: ZipEntry[]) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const root = resolve(destination);
  const totalUncompressed = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
  if (totalUncompressed > MAX_ZIP_BYTES * 4) throw new Error("The extracted ZIP is too large to import safely.");
  for (const entry of entries) {
    const target = resolve(root, normalize(entry.path));
    const pathFromRoot = relative(root, target);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("The ZIP contains an unsafe file path.");
    if (entry.localOffset + 30 > bytes.byteLength || view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error("The ZIP archive is malformed.");
    const nameLength = view.getUint16(entry.localOffset + 26, true); const extraLength = view.getUint16(entry.localOffset + 28, true);
    const dataStart = entry.localOffset + 30 + nameLength + extraLength; const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > bytes.byteLength || entry.uncompressedSize > MAX_ZIP_BYTES) throw new Error("The ZIP archive is malformed or too large.");
    const compressed = bytes.slice(dataStart, dataEnd);
    const content = entry.compression === 0 ? compressed : entry.compression === 8 ? inflateRawSync(compressed) : null;
    if (!content) throw new Error("This ZIP uses an unsupported compression method.");
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, content);
  }
}

export async function inspectZipRepository(file: File): Promise<RepositoryContext> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Upload a .zip file containing a repository.");
  if (file.size === 0 || file.size > MAX_ZIP_BYTES) throw new Error("ZIP files must be between 1 byte and 50 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("That file does not appear to be a valid ZIP archive.");
  const entries = readZipEntries(bytes); const paths = entries.map((entry) => entry.path);
  const markers = ["package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "README.md"];
  if (!paths.length || !paths.some((path) => markers.some((marker) => path === marker || path.endsWith(`/${marker}`)))) throw new Error("This ZIP does not look like a repository. Include project files and try again.");
  const tempRoot = await mkdtemp(join(tmpdir(), "gitlens-zip-"));
  try {
    await extractZip(bytes, tempRoot, entries);
    const { analysis, files } = await analyzeRepository(tempRoot);
    const metadata: RepositoryMetadata = { id: crypto.randomUUID(), name: file.name.replace(/\.zip$/i, ""), source: "zip", fileCount: files.length, primaryLanguage: primaryLanguage(paths), sizeLabel: formatBytes(file.size) };
    return saveRepositoryContext({ repository: metadata, analysis, files, createdAt: new Date().toISOString() });
  } finally { await rm(tempRoot, { recursive: true, force: true }); }
}
