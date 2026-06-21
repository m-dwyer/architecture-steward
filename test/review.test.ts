import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeRepository } from "../src/analyzer.ts";
import { loadConfig, validateConfig } from "../src/config.ts";
import { createBaseline, reviewGraph } from "../src/review.ts";
import type { StewardConfig } from "../src/types.ts";

const tinyBadRepo = path.resolve("test/fixtures/tiny-bad-repo");

test("review reports forbidden dependency with exact evidence", () => {
  const repo = tinyBadRepo;
  const config = loadConfig(repo);
  const result = reviewGraph(repo, config, analyzeRepository(repo, config));

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].ruleId, "domain-no-infrastructure");
  assert.equal(result.findings[0].from, "src/domain/order.ts");
  assert.equal(result.findings[0].to, "src/infrastructure/db.ts");
  assert.equal(result.findings[0].status, "active");
});

test("baseline marks existing finding as known", () => {
  const repo = createFixtureRepo();
  const config = fixtureConfig();
  const first = reviewGraph(repo, config, analyzeRepository(repo, config));
  const baseline = createBaseline(first);
  fs.writeFileSync(path.join(repo, "baseline.json"), JSON.stringify(baseline));

  const result = reviewGraph(repo, { ...config, baseline: "baseline.json" }, analyzeRepository(repo, config));
  assert.equal(result.findings[0].status, "baseline");
});

test("suppression marks finding as suppressed", () => {
  const repo = createFixtureRepo();
  const config = {
    ...fixtureConfig(),
    suppressions: [{ ruleId: "domain-no-infrastructure", reason: "legacy boundary cleanup tracked separately" }],
  };

  const result = reviewGraph(repo, config, analyzeRepository(repo, config));
  assert.equal(result.findings[0].status, "suppressed");
  assert.equal(result.findings[0].suppressionReason, "legacy boundary cleanup tracked separately");
});

test("config validation rejects unknown zone references", () => {
  assert.throws(
    () =>
      validateConfig({
        zones: [{ name: "domain", patterns: ["src/domain/**"] }],
        rules: [{ id: "bad", type: "forbid", from: "domain", to: "missing", severity: "error" }],
      }),
    /must reference a configured zone/,
  );
});

function createFixtureRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "architecture-steward-"));
  fs.mkdirSync(path.join(repo, "src/domain"), { recursive: true });
  fs.mkdirSync(path.join(repo, "src/infrastructure"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src/domain/order.ts"), "import { db } from '../infrastructure/db';\nexport const order = db;\n");
  fs.writeFileSync(path.join(repo, "src/infrastructure/db.ts"), "export const db = {};\n");
  return repo;
}

function fixtureConfig(): StewardConfig {
  return {
    zones: [
      { name: "domain", patterns: ["src/domain/**"] },
      { name: "infrastructure", patterns: ["src/infrastructure/**"] },
    ],
    rules: [
      {
        id: "domain-no-infrastructure",
        type: "forbid",
        from: "domain",
        to: "infrastructure",
        severity: "error",
      },
    ],
    suppressions: [],
  };
}
