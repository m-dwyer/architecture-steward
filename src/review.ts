import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { classifyFile } from "./classify.js";
import type { DependencyGraph, Finding, RuleConfig, StewardConfig, SuppressionConfig, ReviewResult } from "./types.js";

export function reviewGraph(target: string, config: StewardConfig, graph: DependencyGraph): ReviewResult {
  const baseline = loadBaseline(target, config);
  const findings: Finding[] = [];

  for (const edge of graph.edges) {
    if (edge.kind !== "internal") {
      continue;
    }

    const fromZone = classifyFile(edge.from, config);
    const toZone = classifyFile(edge.to, config);
    if (!fromZone || !toZone) {
      continue;
    }

    for (const rule of matchingRules(config.rules, fromZone, toZone)) {
      const violates = rule.type === "forbid";
      if (!violates) {
        continue;
      }

      const fingerprint = createFingerprint(rule.id, edge.from, edge.to);
      const suppression = findSuppression(config.suppressions ?? [], rule.id, edge.from, edge.to);
      findings.push({
        id: `${rule.id}:${fingerprint.slice(0, 12)}`,
        ruleId: rule.id,
        severity: rule.severity,
        status: suppression ? "suppressed" : baseline.has(fingerprint) ? "baseline" : "active",
        from: edge.from,
        to: edge.to,
        fromZone,
        toZone,
        message:
          rule.description ??
          `${fromZone} must not depend on ${toZone}: ${edge.from} imports ${edge.specifier} (${edge.to})`,
        fingerprint,
        suppressionReason: suppression?.reason,
      });
    }
  }

  return {
    target,
    findings: findings.sort(compareFindings),
    unclassifiedFiles: graph.files.filter((file) => !file.zone).map((file) => file.path),
    cycles: graph.cycles,
    externalPackages: graph.externalPackages,
    unresolved: graph.unresolved,
  };
}

export function activeFindings(result: ReviewResult): Finding[] {
  return result.findings.filter((finding) => finding.status === "active");
}

export function createBaseline(result: ReviewResult): string[] {
  return [...new Set(result.findings.map((finding) => finding.fingerprint))].sort();
}

function matchingRules(rules: RuleConfig[], fromZone: string, toZone: string): RuleConfig[] {
  const specificRules = rules.filter((rule) => rule.from === fromZone && rule.to === toZone);
  const allowRules = rules.filter((rule) => rule.type === "allow");
  if (allowRules.length === 0) {
    return specificRules;
  }

  const allowed = allowRules.some((rule) => rule.from === fromZone && rule.to === toZone);
  if (allowed) {
    return specificRules.filter((rule) => rule.type === "forbid");
  }

  return specificRules.concat({
    id: `implicit-deny-${fromZone}-to-${toZone}`,
    type: "forbid",
    from: fromZone,
    to: toZone,
    severity: "error",
    description: `${fromZone} is not explicitly allowed to depend on ${toZone}`,
  });
}

function createFingerprint(ruleId: string, from: string, to: string): string {
  return crypto.createHash("sha256").update(`${ruleId}\0${from}\0${to}`).digest("hex");
}

function findSuppression(
  suppressions: SuppressionConfig[],
  ruleId: string,
  from: string,
  to: string,
): SuppressionConfig | undefined {
  return suppressions.find(
    (suppression) =>
      suppression.ruleId === ruleId &&
      (suppression.from === undefined || suppression.from === from) &&
      (suppression.to === undefined || suppression.to === to),
  );
}

function loadBaseline(target: string, config: StewardConfig): Set<string> {
  if (!config.baseline) {
    return new Set();
  }
  const baselinePath = path.resolve(target, config.baseline);
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline not found: ${baselinePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
    throw new Error(`Baseline must be a JSON array of finding fingerprints: ${baselinePath}`);
  }
  return new Set(parsed);
}

function compareFindings(left: Finding, right: Finding): number {
  return (
    severityRank(right.severity) - severityRank(left.severity) ||
    left.status.localeCompare(right.status) ||
    left.from.localeCompare(right.from) ||
    left.to.localeCompare(right.to)
  );
}

function severityRank(severity: string): number {
  switch (severity) {
    case "error":
      return 3;
    case "warn":
      return 2;
    default:
      return 1;
  }
}
