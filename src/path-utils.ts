import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function relativePath(root: string, value: string): string {
  return toPosixPath(path.relative(root, value));
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}
