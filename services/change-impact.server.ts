import type { ChangeImpact, RepositoryContext } from "@/types/repository";

const history = new Map<string, ChangeImpact[]>();

function findTarget(context: RepositoryContext, query: string) {
  const quoted = query.match(/["“]([^"”]+)["”]/)?.[1] ?? "";
  const intentMatch = query.match(/\b(rename|change|remove|delete|deprecate|update|add|introduce|create)\b/i)?.[1]?.toLowerCase() ?? "";
  const cleaned = query
    .replace(/["“”]/g, " ")
    .replace(/\b(what|happens|if|would|the|a|an|this|that|for|to|in|on|of|and|with)\b/gi, " ")
    .replace(/[^a-zA-Z0-9_/\.\-\s]/g, " ")
    .trim();
  const terms = [...new Set((quoted || cleaned).match(/[A-Za-z][A-Za-z0-9_\-]{2,}/g)?.filter((term) => term.length > 2) ?? [])];

  const scored = context.files
    .map((file) => {
      const path = file.path.toLowerCase();
      const preview = (file.preview ?? "").toLowerCase();
      let score = 0;

      if (quoted) {
        if (path.includes(quoted.toLowerCase())) score += 10;
        if (preview.includes(quoted.toLowerCase())) score += 6;
      }

      terms.forEach((term) => {
        const low = term.toLowerCase();
        if (path.includes(low)) score += 4;
        if (preview.includes(low)) score += 1;
      });

      if (/\b(api|route|controller|handler)\b/i.test(file.path)) score += 1;
      return { file, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const match = scored[0]?.file ?? context.files.find((file) => file.path.toLowerCase().includes(terms[0]?.toLowerCase() ?? ""));
  const target = quoted || (match ? match.path.split("/").at(-1) ?? match.path : terms[0] ?? null);
  return { target, file: match, terms, intent: intentMatch };
}

export function simulateChangeImpact(context: RepositoryContext, query: string): ChangeImpact {
  const { target, file, terms, intent } = findTarget(context, query);
  const action = intent === "rename" || intent === "change" || intent === "update" ? "rename" : intent === "remove" || intent === "delete" || intent === "deprecate" ? "remove" : intent === "add" || intent === "introduce" || intent === "create" ? "add" : "modify";

  const semanticFiles = context.files.filter((candidate) =>
    terms.some((term) => candidate.path.toLowerCase().includes(term.toLowerCase()) || candidate.preview?.toLowerCase().includes(term.toLowerCase())),
  );

  const roots = new Set<string>([...(file ? [file.path] : []), ...semanticFiles.map((candidate) => candidate.path)]);
  const affected = new Set(roots);
  let changed = true;

  while (changed) {
    changed = false;
    for (const edge of context.analysis.dependencies) {
      if (affected.has(edge.target) && !affected.has(edge.source)) {
        affected.add(edge.source);
        changed = true;
      }
    }
  }

  const affectedFiles = [...affected].slice(0, 50);
  const apiFiles = affectedFiles.filter((path) => /(^|\/)(api|routes?|controllers?)(\/|$)/i.test(path));
  const testCandidates = context.files
    .filter((candidate) => /(?:test|spec)\.[jt]sx?$/i.test(candidate.path) && (affectedFiles.some((path) => candidate.path.includes(path.split("/").at(-1)?.split(".")[0] ?? "")) || terms.some((term) => candidate.path.toLowerCase().includes(term.toLowerCase()))))
    .map((candidate) => candidate.path)
    .slice(0, 20);

  const intentWeight = { rename: 18, remove: 26, modify: 12, add: 6 }[action];
  const riskScore = Math.min(98, 12 + intentWeight + affectedFiles.length * 3 + apiFiles.length * 14 + (context.analysis.circularDependencies.length ? 10 : 0));
  const confidence = roots.size ? Math.max(55, 96 - affectedFiles.length) : 38;

  const actionText =
    action === "rename"
      ? "Renaming or changing this target may require updates across imports, references, and integration points."
      : action === "remove"
      ? "Removing this target can break callers unless the dependency chain has been migrated or guarded."
      : action === "add"
      ? "Adding a new module is lower risk, but make sure the wiring and tests are in place."
      : "Modifying this target may alter behavior for every file that depends on it."

  const reasoning: string[] = [];
  if (file) {
    reasoning.push(`Matched “${target}” in ${file.path}.`);
  } else if (terms.length) {
    reasoning.push(`Inferred target from query terms: ${terms.map((term) => `“${term}”`).join(", ")}.`);
  } else {
    reasoning.push("No explicit file match was found; using a broad repository impact estimate.");
  }
  reasoning.push(actionText);

  if (affectedFiles.length) {
    reasoning.push(`${affectedFiles.length} file${affectedFiles.length === 1 ? "" : "s"} depend directly or transitively on the selected area.`);
  }
  reasoning.push(apiFiles.length ? `${apiFiles.length} API surface${apiFiles.length === 1 ? " may" : "s may"} be affected.` : "No API route dependencies were detected.");
  reasoning.push(context.analysis.circularDependencies.length ? "Circular imports increase the risk of indirect breakage." : "No circular imports were detected in the analyzed graph.");

  const impact: ChangeImpact = {
    query,
    target,
    affectedFiles,
    breakingApis: apiFiles,
    testsRequired: testCandidates,
    estimatedEffort: riskScore > 68 ? "High" : riskScore > 35 ? "Medium" : "Low",
    riskScore,
    confidence,
    reasoning,
    createdAt: new Date().toISOString(),
  };

  history.set(context.repository.id, [impact, ...(history.get(context.repository.id) ?? [])].slice(0, 12));
  return impact;
}

export function getImpactHistory(repositoryId: string) {
  return history.get(repositoryId) ?? [];
}
