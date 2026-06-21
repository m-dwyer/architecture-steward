import type { Finding, ReviewResult } from "./types.ts";

export function renderJson(result: ReviewResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function renderMarkdown(result: ReviewResult): string {
  const active = result.findings.filter((finding) => finding.status === "active");
  const baseline = result.findings.filter((finding) => finding.status === "baseline");
  const suppressed = result.findings.filter((finding) => finding.status === "suppressed");

  const lines = [
    "# Architecture Steward Review",
    "",
    `Target: \`${result.target}\``,
    "",
    "## Summary",
    "",
    `- Active findings: ${active.length}`,
    `- Baseline findings: ${baseline.length}`,
    `- Suppressed findings: ${suppressed.length}`,
    `- Cycles: ${result.cycles.length}`,
    `- Unresolved imports: ${result.unresolved.length}`,
    `- Unclassified files: ${result.unclassifiedFiles.length}`,
    "",
  ];

  appendFindingSection(lines, "Active Findings", active);
  appendFindingSection(lines, "Baseline Findings", baseline);
  appendFindingSection(lines, "Suppressed Findings", suppressed);

  if (result.cycles.length > 0) {
    lines.push("## Cycles", "");
    for (const cycle of result.cycles) {
      lines.push(`- ${cycle.map((entry) => `\`${entry}\``).join(" -> ")}`);
    }
    lines.push("");
  }

  if (result.unresolved.length > 0) {
    lines.push("## Unresolved Imports", "");
    for (const edge of result.unresolved) {
      lines.push(`- \`${edge.from}\` imports \`${edge.specifier}\``);
    }
    lines.push("");
  }

  if (result.unclassifiedFiles.length > 0) {
    lines.push("## Unclassified Files", "");
    for (const file of result.unclassifiedFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function appendFindingSection(lines: string[], title: string, findings: Finding[]): void {
  if (findings.length === 0) {
    return;
  }

  lines.push(`## ${title}`, "");
  for (const finding of findings) {
    lines.push(`- **${finding.severity.toUpperCase()}** \`${finding.ruleId}\``);
    lines.push(`  - From: \`${finding.from}\` (${finding.fromZone ?? "unclassified"})`);
    lines.push(`  - To: \`${finding.to}\` (${finding.toZone ?? "unclassified"})`);
    lines.push(`  - ${finding.message}`);
    lines.push(`  - Fingerprint: \`${finding.fingerprint}\``);
    if (finding.suppressionReason) {
      lines.push(`  - Suppression: ${finding.suppressionReason}`);
    }
  }
  lines.push("");
}
