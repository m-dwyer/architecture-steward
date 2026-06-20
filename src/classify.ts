import { matchesAnyPattern } from "./path-utils.js";
import type { SourceFile, StewardConfig } from "./types.js";

export function classifyFile(filePath: string, config: StewardConfig): string | undefined {
  const zone = config.zones.find((candidate) => matchesAnyPattern(filePath, candidate.patterns));
  return zone?.name;
}

export function classifyFiles(paths: string[], config: StewardConfig): SourceFile[] {
  return paths.map((filePath) => ({
    path: filePath,
    zone: classifyFile(filePath, config),
  }));
}
