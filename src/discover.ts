import path from "node:path";
import type { DependencyGraph } from "./types.js";

export function renderDiscovery(graph: DependencyGraph): string {
  const directories = new Map<string, number>();
  for (const file of graph.files) {
    const directory = firstMeaningfulDirectory(file.path);
    directories.set(directory, (directories.get(directory) ?? 0) + 1);
  }

  const lines = [
    "# Architecture Steward Discovery",
    "",
    "## Repository Facts",
    "",
    `- Source files: ${graph.files.length}`,
    `- Dependency edges: ${graph.edges.length}`,
    `- External packages: ${graph.externalPackages.length}`,
    `- Cycles: ${graph.cycles.length}`,
    `- Unresolved imports: ${graph.unresolved.length}`,
    "",
    "## Candidate Zones",
    "",
  ];

  for (const [directory, count] of [...directories.entries()].sort((left, right) => right[1] - left[1])) {
    lines.push(`- \`${directory}/**\` (${count} files)`);
  }

  if (graph.externalPackages.length > 0) {
    lines.push("", "## External Packages", "");
    for (const packageName of graph.externalPackages) {
      lines.push(`- \`${packageName}\``);
    }
  }

  lines.push("", "Candidate zones are suggestions only. Confirm intent in architecture-steward.config.json before review.");
  return `${lines.join("\n").trimEnd()}\n`;
}

function firstMeaningfulDirectory(filePath: string): string {
  const parts = filePath.split(path.posix.sep);
  if (parts[0] === "src" && parts[1]) {
    return `src/${parts[1]}`;
  }
  return parts.length > 1 ? parts[0] : ".";
}
