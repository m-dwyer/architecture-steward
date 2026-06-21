#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import yargs from "yargs";
import type { Argv } from "yargs";
import { hideBin } from "yargs/helpers";
import { analyzeRepository } from "./analyzer.ts";
import { createStarterConfig, defaultConfigFileName, loadConfig } from "./config.ts";
import { renderDiscovery } from "./discover.ts";
import { exportDependencyCruiserConfig } from "./exporters.ts";
import { renderJson, renderMarkdown } from "./report.ts";
import { activeFindings, createBaseline, reviewGraph } from "./review.ts";

function readVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function resolveTarget(target: string): string {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Target must be an existing directory: ${resolved}`);
  }
  return resolved;
}

function optionalConfig(target: string, explicitPath?: string) {
  const configPath = explicitPath ? path.resolve(explicitPath) : path.join(target, defaultConfigFileName);
  if (fs.existsSync(configPath)) {
    return loadConfig(target, explicitPath);
  }
  return createStarterConfig();
}

const repoOptions = (y: Argv) =>
  y
    .option("target", { type: "string", default: ".", describe: "Repository to analyze (path)" })
    .option("config", { type: "string", describe: "Path to a non-default config file" });

const reportOptions = (y: Argv) =>
  repoOptions(y).option("format", {
    choices: ["markdown", "json"] as const,
    default: "markdown" as const,
    describe: "Output format",
  });

const cli = yargs(hideBin(process.argv))
  .scriptName("archie")
  .usage("$0 <command> [options]")
  .command(
    "init",
    "Write a starter config to stdout",
    (y) => y,
    () => {
      process.stdout.write(`${JSON.stringify(createStarterConfig(), null, 2)}\n`);
    },
  )
  .command(
    "discover",
    "Summarize dependency facts and likely zones",
    reportOptions,
    (args) => {
      const target = resolveTarget(args.target);
      const config = optionalConfig(target, args.config);
      const graph = analyzeRepository(target, config);
      process.stdout.write(args.format === "json" ? `${JSON.stringify(graph, null, 2)}\n` : renderDiscovery(graph));
    },
  )
  .command(
    "review",
    "Evaluate dependency facts against architecture rules",
    reportOptions,
    (args) => {
      const target = resolveTarget(args.target);
      const config = loadConfig(target, args.config);
      const result = reviewGraph(target, config, analyzeRepository(target, config));
      process.stdout.write(args.format === "json" ? renderJson(result) : renderMarkdown(result));
      if (activeFindings(result).some((finding) => finding.severity === "error")) {
        process.exitCode = 1;
      }
    },
  )
  .command(
    "baseline",
    "Write current finding fingerprints to stdout",
    repoOptions,
    (args) => {
      const target = resolveTarget(args.target);
      const config = loadConfig(target, args.config);
      const result = reviewGraph(target, config, analyzeRepository(target, config));
      process.stdout.write(`${JSON.stringify(createBaseline(result), null, 2)}\n`);
    },
  )
  .command(
    "export <kind>",
    "Export an equivalent config for another tool",
    (y) =>
      repoOptions(y).positional("kind", {
        choices: ["dependency-cruiser"] as const,
        describe: "Export target tool",
      }),
    (args) => {
      const target = resolveTarget(args.target);
      const config = loadConfig(target, args.config);
      process.stdout.write(exportDependencyCruiserConfig(config));
    },
  )
  .completion("completion", "Print a shell completion script (see README)")
  .demandCommand(1, "Specify a command. Run `archie --help` for usage.")
  .strict()
  .version(readVersion())
  .alias("version", "v")
  .help()
  .alias("help", "h")
  .wrap(Math.min(100, process.stdout.columns ?? 100))
  .fail((msg, err) => {
    process.stderr.write(`${err ? err.message : msg}\n`);
    process.exit(1);
  });

await cli.parseAsync();
