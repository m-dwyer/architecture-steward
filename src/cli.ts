#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { analyzeRepository } from "./analyzer.js";
import { createStarterConfig, defaultConfigFileName, loadConfig } from "./config.js";
import { renderDiscovery } from "./discover.js";
import { exportDependencyCruiserConfig } from "./exporters.js";
import { renderJson, renderMarkdown } from "./report.js";
import { activeFindings, createBaseline, reviewGraph } from "./review.js";

interface CliOptions {
  target: string;
  config?: string;
  format: "markdown" | "json";
}

async function main(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const args = command === "export" ? rest : [subcommand, ...rest].filter(Boolean);
  const options = parseOptions(args);

  try {
    switch (command) {
      case "init":
        process.stdout.write(`${JSON.stringify(createStarterConfig(), null, 2)}\n`);
        return 0;
      case "discover": {
        const config = optionalConfig(options.target, options.config);
        const graph = analyzeRepository(options.target, config);
        process.stdout.write(options.format === "json" ? `${JSON.stringify(graph, null, 2)}\n` : renderDiscovery(graph));
        return 0;
      }
      case "review": {
        const config = loadConfig(options.target, options.config);
        const result = reviewGraph(options.target, config, analyzeRepository(options.target, config));
        process.stdout.write(options.format === "json" ? renderJson(result) : renderMarkdown(result));
        return activeFindings(result).some((finding) => finding.severity === "error") ? 1 : 0;
      }
      case "baseline": {
        const config = loadConfig(options.target, options.config);
        const result = reviewGraph(options.target, config, analyzeRepository(options.target, config));
        process.stdout.write(`${JSON.stringify(createBaseline(result), null, 2)}\n`);
        return 0;
      }
      case "export": {
        if (subcommand !== "dependency-cruiser") {
          throw new Error("Supported export targets: dependency-cruiser");
        }
        const config = loadConfig(options.target, options.config);
        process.stdout.write(exportDependencyCruiserConfig(config));
        return 0;
      }
      case "help":
      case undefined:
        process.stdout.write(helpText());
        return 0;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function parseOptions(args: string[]): CliOptions {
  let target = process.cwd();
  let config: string | undefined;
  let format: "markdown" | "json" = "markdown";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--target":
        target = path.resolve(requiredValue(args, ++index, "--target"));
        break;
      case "--config":
        config = path.resolve(requiredValue(args, ++index, "--config"));
        break;
      case "--format": {
        const value = requiredValue(args, ++index, "--format");
        if (value !== "markdown" && value !== "json") {
          throw new Error("--format must be markdown or json");
        }
        format = value;
        break;
      }
      default:
        if (arg !== undefined) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`Target must be an existing directory: ${target}`);
  }

  return { target, config, format };
}

function optionalConfig(target: string, explicitPath?: string) {
  const configPath = explicitPath ?? path.join(target, defaultConfigFileName);
  if (fs.existsSync(configPath)) {
    return loadConfig(target, explicitPath);
  }
  return createStarterConfig();
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function helpText(): string {
  return `Architecture Steward

Usage:
  architecture-steward init [--target <path>]
  architecture-steward discover [--target <path>] [--config <path>] [--format markdown|json]
  architecture-steward review [--target <path>] [--config <path>] [--format markdown|json]
  architecture-steward baseline [--target <path>] [--config <path>]
  architecture-steward export dependency-cruiser [--target <path>] [--config <path>]

`;
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
