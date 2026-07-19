export type ImportSource = "github" | "zip";

export type RepositoryMetadata = {
  id: string;
  name: string;
  source: ImportSource;
  url?: string;
  fileCount: number;
  primaryLanguage: string;
  defaultBranch?: string;
  sizeLabel: string;
};

export type RepositoryFile = { path: string; language: string; size: number; preview?: string };
export type RepositoryModule = { name: string; kind: "authentication" | "database" | "api" | "configuration" | "feature" | "shared"; files: string[] };
export type DependencyEdge = { source: string; target: string; kind: "import" | "require"; circular?: boolean };
export type ArchitectureNode = { id: string; label: string; kind: RepositoryModule["kind"]; files: string[] };
export type ArchitectureEdge = { source: string; target: string; relationship: string };
export type RepositoryAnalysis = {
  fileTree: string[];
  languages: { name: string; files: number }[];
  frameworks: string[];
  modules: RepositoryModule[];
  dependencies: DependencyEdge[];
  circularDependencies: string[][];
  architecture: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
  summary: string;
};
export type RepositoryContext = { repository: RepositoryMetadata; analysis: RepositoryAnalysis; files: RepositoryFile[]; createdAt: string };

export type RepositoryImportResult =
  | { success: true; repository: RepositoryMetadata }
  | { success: false; error: string };

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
export type ChangeImpact = { query: string; target: string | null; affectedFiles: string[]; breakingApis: string[]; testsRequired: string[]; estimatedEffort: "Low" | "Medium" | "High"; riskScore: number; confidence: number; reasoning: string[]; createdAt: string };
export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type RiskFinding = { id: string; category: "dead-code" | "large-file" | "duplicate-logic" | "security" | "validation" | "error-handling"; severity: RiskSeverity; title: string; description: string; files: string[]; recommendation: string };
export type RepositoryDocumentation = { readme: string; architecture: string; folders: string; api: string };
