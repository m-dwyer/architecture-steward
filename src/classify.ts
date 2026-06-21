import { matchesAnyPattern } from "./path-utils.ts";
import type { SourceFile, StewardConfig } from "./types.ts";

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
