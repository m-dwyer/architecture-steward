import fs from "node:fs";
import path from "node:path";
import type { RuleConfig, StewardConfig, SuppressionConfig, ZoneConfig } from "./types.ts";

export const defaultConfigFileName = "architecture-steward.config.json";

export function loadConfig(target: string, explicitPath?: string): StewardConfig {
  const configPath = explicitPath ? path.resolve(explicitPath) : path.join(target, defaultConfigFileName);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
  return validateConfig(parsed, configPath);
}

export function validateConfig(value: unknown, source = "config"): StewardConfig {
  if (!isRecord(value)) {
    throw new Error(`${source} must be a JSON object`);
  }

  const zones = value.zones;
  const rules = value.rules;
  const suppressions = value.suppressions ?? [];
  const baseline = value.baseline;

  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error(`${source}.zones must be a non-empty array`);
  }
  if (!Array.isArray(rules)) {
    throw new Error(`${source}.rules must be an array`);
  }
  if (!Array.isArray(suppressions)) {
    throw new Error(`${source}.suppressions must be an array when provided`);
  }
  if (baseline !== undefined && typeof baseline !== "string") {
    throw new Error(`${source}.baseline must be a string when provided`);
  }

  const parsedZones = zones.map((zone, index) => validateZone(zone, `${source}.zones[${index}]`));
  const zoneNames = new Set(parsedZones.map((zone) => zone.name));
  if (zoneNames.size !== parsedZones.length) {
    throw new Error(`${source}.zones must have unique names`);
  }

  const parsedRules = rules.map((rule, index) => validateRule(rule, zoneNames, `${source}.rules[${index}]`));
  const parsedSuppressions = suppressions.map((suppression, index) =>
    validateSuppression(suppression, `${source}.suppressions[${index}]`),
  );

  return {
    zones: parsedZones,
    rules: parsedRules,
    suppressions: parsedSuppressions,
    baseline,
  };
}

export function createStarterConfig(): StewardConfig {
  return {
    zones: [
      { name: "ui", patterns: ["src/ui/**"] },
      { name: "application", patterns: ["src/application/**"] },
      { name: "domain", patterns: ["src/domain/**"] },
      { name: "infrastructure", patterns: ["src/infrastructure/**"] },
    ],
    rules: [
      { id: "domain-no-infrastructure", type: "forbid", from: "domain", to: "infrastructure", severity: "error" },
      { id: "domain-no-ui", type: "forbid", from: "domain", to: "ui", severity: "error" },
      { id: "ui-no-infrastructure", type: "forbid", from: "ui", to: "infrastructure", severity: "warn" },
    ],
    suppressions: [],
  };
}

function validateZone(value: unknown, source: string): ZoneConfig {
  if (!isRecord(value)) {
    throw new Error(`${source} must be an object`);
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new Error(`${source}.name must be a non-empty string`);
  }
  if (!Array.isArray(value.patterns) || !value.patterns.every((pattern) => typeof pattern === "string")) {
    throw new Error(`${source}.patterns must be an array of strings`);
  }
  return { name: value.name, patterns: value.patterns };
}

function validateRule(value: unknown, zoneNames: Set<string>, source: string): RuleConfig {
  if (!isRecord(value)) {
    throw new Error(`${source} must be an object`);
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new Error(`${source}.id must be a non-empty string`);
  }
  if (value.type !== "allow" && value.type !== "forbid") {
    throw new Error(`${source}.type must be "allow" or "forbid"`);
  }
  if (typeof value.from !== "string" || !zoneNames.has(value.from)) {
    throw new Error(`${source}.from must reference a configured zone`);
  }
  if (typeof value.to !== "string" || !zoneNames.has(value.to)) {
    throw new Error(`${source}.to must reference a configured zone`);
  }
  if (value.severity !== "info" && value.severity !== "warn" && value.severity !== "error") {
    throw new Error(`${source}.severity must be "info", "warn", or "error"`);
  }
  if (value.description !== undefined && typeof value.description !== "string") {
    throw new Error(`${source}.description must be a string when provided`);
  }
  return {
    id: value.id,
    type: value.type,
    from: value.from,
    to: value.to,
    severity: value.severity,
    description: value.description,
  };
}

function validateSuppression(value: unknown, source: string): SuppressionConfig {
  if (!isRecord(value)) {
    throw new Error(`${source} must be an object`);
  }
  if (typeof value.ruleId !== "string" || value.ruleId.length === 0) {
    throw new Error(`${source}.ruleId must be a non-empty string`);
  }
  if (value.from !== undefined && typeof value.from !== "string") {
    throw new Error(`${source}.from must be a string when provided`);
  }
  if (value.to !== undefined && typeof value.to !== "string") {
    throw new Error(`${source}.to must be a string when provided`);
  }
  if (typeof value.reason !== "string" || value.reason.length === 0) {
    throw new Error(`${source}.reason must be a non-empty string`);
  }
  return {
    ruleId: value.ruleId,
    from: value.from,
    to: value.to,
    reason: value.reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
