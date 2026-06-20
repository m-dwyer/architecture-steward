import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { classifyFiles } from "./classify.js";
import { relativePath, toPosixPath } from "./path-utils.js";
import type { DependencyEdge, DependencyGraph, StewardConfig } from "./types.js";

const supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
const ignoredDirectories = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".turbo"]);

const importPatterns = [
  /import\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
  /export\s+(?:type\s+)?[^'"]*?\s+from\s+["']([^"']+)["']/g,
  /require\s*\(\s*["']([^"']+)["']\s*\)/g,
];

export function analyzeRepository(target: string, config: StewardConfig): DependencyGraph {
  return analyzeWithDependencyCruiser(target, config) ?? analyzeWithBuiltInScanner(target, config);
}

function analyzeWithDependencyCruiser(target: string, config: StewardConfig): DependencyGraph | undefined {
  const root = path.resolve(target);
  const depCruiseBin = dependencyCruiserBin();
  if (!depCruiseBin) {
    return undefined;
  }

  try {
    const output = execFileSync(
      process.execPath,
      [depCruiseBin, ".", "--no-config", "--output-type", "json", "--exclude", "node_modules|dist|build|coverage|\\.git"],
      { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    return graphFromDependencyCruiserOutput(root, config, JSON.parse(output) as DependencyCruiserOutput);
  } catch {
    return undefined;
  }
}

function analyzeWithBuiltInScanner(target: string, config: StewardConfig): DependencyGraph {
  const root = path.resolve(target);
  const absoluteFiles = listSourceFiles(root);
  const relativeFiles = absoluteFiles.map((file) => relativePath(root, file));
  const fileSet = new Set(relativeFiles);
  const edges: DependencyEdge[] = [];

  for (const absoluteFile of absoluteFiles) {
    const from = relativePath(root, absoluteFile);
    const text = fs.readFileSync(absoluteFile, "utf8");
    for (const specifier of extractSpecifiers(text)) {
      edges.push(resolveEdge(root, from, specifier, fileSet));
    }
  }

  const unresolved = edges.filter((edge) => edge.kind === "unresolved");
  const externalPackages = [...new Set(edges.filter((edge) => edge.kind === "external").map((edge) => edge.to))].sort();

  return {
    files: classifyFiles(relativeFiles, config),
    edges,
    cycles: findCycles(edges.filter((edge) => edge.kind === "internal")),
    externalPackages,
    unresolved,
  };
}

interface DependencyCruiserOutput {
  modules?: DependencyCruiserModule[];
}

interface DependencyCruiserModule {
  source: string;
  coreModule?: boolean;
  couldNotResolve?: boolean;
  dependencies?: DependencyCruiserDependency[];
}

interface DependencyCruiserDependency {
  module: string;
  resolved?: string;
  coreModule?: boolean;
  couldNotResolve?: boolean;
}

function graphFromDependencyCruiserOutput(
  root: string,
  config: StewardConfig,
  output: DependencyCruiserOutput,
): DependencyGraph {
  const modules = output.modules ?? [];
  const sourceFiles = modules
    .filter((module) => isSupportedSource(module.source) && !module.coreModule && !module.couldNotResolve)
    .map((module) => toPosixPath(module.source))
    .sort();
  const fileSet = new Set(sourceFiles);
  const edges: DependencyEdge[] = [];

  for (const module of modules) {
    const from = toPosixPath(module.source);
    if (!fileSet.has(from)) {
      continue;
    }
    for (const dependency of module.dependencies ?? []) {
      const resolved = dependency.resolved ? toPosixPath(dependency.resolved) : undefined;
      if (dependency.couldNotResolve) {
        edges.push({ from, to: dependency.module, specifier: dependency.module, kind: "unresolved" });
      } else if (resolved && fileSet.has(resolved)) {
        edges.push({ from, to: resolved, specifier: dependency.module, kind: "internal" });
      } else {
        edges.push({ from, to: externalPackageName(dependency.module), specifier: dependency.module, kind: "external" });
      }
    }
  }

  const unresolved = edges.filter((edge) => edge.kind === "unresolved");
  const externalPackages = [...new Set(edges.filter((edge) => edge.kind === "external").map((edge) => edge.to))].sort();

  return {
    files: classifyFiles(sourceFiles, config),
    edges,
    cycles: findCycles(edges.filter((edge) => edge.kind === "internal")),
    externalPackages,
    unresolved,
  };
}

function dependencyCruiserBin(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve("dependency-cruiser/package.json");
    return path.join(path.dirname(packageJsonPath), "bin/dependency-cruise.mjs");
  } catch {
    return undefined;
  }
}

function listSourceFiles(root: string): string[] {
  const results: string[] = [];
  walk(root, results);
  return results.sort();
}

function walk(directory: string, results: string[]): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(path.join(directory, entry.name), results);
      }
      continue;
    }
    if (entry.isFile() && supportedExtensions.includes(path.extname(entry.name))) {
      results.push(path.join(directory, entry.name));
    }
  }
}

function isSupportedSource(filePath: string): boolean {
  return supportedExtensions.includes(path.extname(filePath));
}

function extractSpecifiers(text: string): string[] {
  const specifiers: string[] = [];
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveEdge(root: string, from: string, specifier: string, fileSet: Set<string>): DependencyEdge {
  if (!specifier.startsWith(".")) {
    return {
      from,
      to: externalPackageName(specifier),
      specifier,
      kind: "external",
    };
  }

  const fromDirectory = path.dirname(path.join(root, from));
  const resolved = resolveRelativeImport(root, fromDirectory, specifier, fileSet);
  return {
    from,
    to: resolved ?? specifier,
    specifier,
    kind: resolved ? "internal" : "unresolved",
  };
}

function resolveRelativeImport(
  root: string,
  fromDirectory: string,
  specifier: string,
  fileSet: Set<string>,
): string | undefined {
  const base = path.resolve(fromDirectory, specifier);
  const candidates = [
    base,
    ...supportedExtensions.map((extension) => `${base}${extension}`),
    ...supportedExtensions.map((extension) => path.join(base, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    const relative = toPosixPath(path.relative(root, candidate));
    if (fileSet.has(relative)) {
      return relative;
    }
  }
  return undefined;
}

function externalPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function findCycles(edges: DependencyEdge[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = graph.get(edge.from) ?? [];
    targets.push(edge.to);
    graph.set(edge.from, targets);
  }

  const cycles = new Set<string>();
  const results: string[][] = [];

  for (const node of graph.keys()) {
    visit(node, [], new Set<string>());
  }

  function visit(node: string, stack: string[], seen: Set<string>): void {
    const existing = stack.indexOf(node);
    if (existing >= 0) {
      const cycle = stack.slice(existing).concat(node);
      const key = canonicalCycleKey(cycle);
      if (!cycles.has(key)) {
        cycles.add(key);
        results.push(cycle);
      }
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    for (const next of graph.get(node) ?? []) {
      visit(next, stack.concat(node), seen);
    }
  }

  return results.sort((left, right) => left.join(">").localeCompare(right.join(">")));
}

function canonicalCycleKey(cycle: string[]): string {
  const body = cycle.slice(0, -1);
  const rotations = body.map((_, index) => body.slice(index).concat(body.slice(0, index)).join(">"));
  return rotations.sort()[0];
}
