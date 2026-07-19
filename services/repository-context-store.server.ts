import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { RepositoryContext } from "@/types/repository";

const contexts = new Map<string, RepositoryContext>();
const storeFolder = join(process.cwd(), "./.gitlens-contexts");

async function ensureStoreFolder() {
  try {
    await stat(storeFolder);
  } catch {
    await mkdir(storeFolder, { recursive: true });
  }
}

export async function saveRepositoryContext(context: RepositoryContext) {
  contexts.set(context.repository.id, context);
  await ensureStoreFolder();
  const path = join(storeFolder, `${context.repository.id}.json`);
  await writeFile(path, JSON.stringify(context), "utf8");
  return context;
}

export async function getRepositoryContext(id: string) {
  if (contexts.has(id)) return contexts.get(id) as RepositoryContext;
  const path = join(storeFolder, `${id}.json`);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as RepositoryContext;
    contexts.set(id, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}
