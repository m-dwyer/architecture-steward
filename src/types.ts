export type Severity = "info" | "warn" | "error";

export interface ZoneConfig {
  name: string;
  patterns: string[];
}

export interface RuleConfig {
  id: string;
  type: "allow" | "forbid";
  from: string;
  to: string;
  severity: Severity;
  description?: string;
}

export interface SuppressionConfig {
  ruleId: string;
  from?: string;
  to?: string;
  reason: string;
}

export interface StewardConfig {
  zones: ZoneConfig[];
  rules: RuleConfig[];
  suppressions?: SuppressionConfig[];
  baseline?: string;
}

export interface SourceFile {
  path: string;
  zone?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  specifier: string;
  kind: "internal" | "external" | "unresolved";
}

export interface DependencyGraph {
  files: SourceFile[];
  edges: DependencyEdge[];
  cycles: string[][];
  externalPackages: string[];
  unresolved: DependencyEdge[];
}

export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  status: "active" | "baseline" | "suppressed";
  from: string;
  to: string;
  fromZone?: string;
  toZone?: string;
  message: string;
  fingerprint: string;
  suppressionReason?: string;
}

export interface ReviewResult {
  target: string;
  findings: Finding[];
  unclassifiedFiles: string[];
  cycles: string[][];
  externalPackages: string[];
  unresolved: DependencyEdge[];
}
