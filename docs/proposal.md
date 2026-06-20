# Architecture Steward MVP Proposal

## Summary

Architecture Steward starts as a TypeScript-first architecture review CLI for existing JavaScript and TypeScript repositories.

The MVP validates one focused thesis:

> Teams need a practical way to compare dependency facts from a real codebase against human-declared architecture intent, then get specific, actionable findings they can adopt incrementally.

The product should behave less like an autonomous "AI architect" and more like an architecture reviewer with reliable static-analysis evidence. Deterministic tools should extract facts. Humans should declare intent. Architecture Steward should compare the two and report concrete drift.

## Product Thesis

Architecture drift becomes expensive when intended boundaries are implicit. Architecture Steward makes those boundaries explicit, checks implementation against them, and helps teams adopt enforcement without requiring a rewrite.

The first useful version should answer:

- What does this repository actually depend on?
- What boundaries did the team say should exist?
- Where does implementation violate those boundaries?
- Which violations are new, known legacy debt, or explicitly suppressed?
- What can be enforced with existing ecosystem tools?

## Guiding Principles

- Deterministic facts over AI inference.
- Human-declared intent over generated authority.
- Incremental adoption over big-bang cleanup.
- Specific findings over generic architecture advice.
- Existing tools over custom parsers where practical.
- Extensible internals without premature polyglot scope.
- CI usefulness over one-time documentation generation.

## MVP Scope

The MVP targets existing TypeScript and JavaScript repositories.

It provides:

- A CLI for analyzing a target repository.
- Dependency fact extraction for TypeScript and JavaScript code.
- A small architecture rules model for zones and dependency boundaries.
- A review engine that compares repo facts against declared intent.
- Markdown and JSON reports with exact evidence.
- Baselines and suppressions so legacy repos can adopt the tool incrementally.
- Export to existing enforcement tooling where practical.

It does not include:

- Multi-language support.
- Automatic architecture selection.
- Repository template generation.
- Full ADR generation.
- Continuous agent guidance.
- Autonomous enforcement decisions.
- Broad AI-generated architecture documentation.
- IDE integration.
- Organization-level dashboards.

## Architecture

Architecture Steward is organized around three layers of truth.

### Repository Facts

Repository facts are extracted deterministically from the target codebase.

Examples:

- Source files.
- Import edges.
- Resolved internal dependencies.
- External package usage.
- Dependency cycles.
- Unresolved imports.
- Directory/module groupings.
- TypeScript path aliases where supported.
- Monorepo package relationships where supported.

For the TypeScript MVP, dependency extraction should prefer `dependency-cruiser`. A built-in scanner may exist as a fallback, but the long-term intent is to lean on proven ecosystem tools.

### Architecture Intent

Architecture intent is declared by humans in `architecture-steward.config.json`.

The config should support:

- Named zones such as layers or modules.
- File/path patterns that assign files to zones.
- Allowed or forbidden dependencies between zones.
- Rule IDs.
- Rule severity.
- Suppressions with rationale.
- Baseline references.

This config is the source of truth for enforceable rules, not the entire architecture. Broader rationale, tradeoffs, and human context belong in normal architecture documentation.

### Review Engine

The review engine compares repository facts against architecture intent.

Findings should include:

- Rule ID.
- Severity.
- Source file.
- Target file or package.
- Source zone.
- Target zone.
- Violating dependency edge.
- Finding fingerprint.
- Status: active, baseline, or suppressed.
- Short explanation.

AI may later explain or summarize findings, but it should not create enforceable truth without human confirmation.

## Commands

The intended CLI surface is:

- `architecture-steward init`
- `architecture-steward discover`
- `architecture-steward review`
- `architecture-steward baseline`
- `architecture-steward export dependency-cruiser`

All commands should accept:

- `--target <path>` for the repository being analyzed.
- `--config <path>` where config is needed.

Review and discovery commands should support:

- `--format markdown`
- `--format json`

## Milestones

Each milestone should be small enough to implement and validate in a fresh context window.

### Milestone 1: Project Skeleton and CLI

Goal:

Create the initial TypeScript CLI foundation.

Capabilities:

- Initialize a TypeScript package.
- Provide a CLI entrypoint.
- Add command routing for `init`, `discover`, `review`, `baseline`, and `export`.
- Accept a target repository path.
- Load a local config file when required.
- Return clear errors for missing config, invalid paths, and unsupported commands.

Validation:

- CLI builds successfully.
- CLI can run locally.
- `init` emits a starter config.
- Unknown commands fail clearly.
- Invalid target paths fail clearly.

Completion criteria:

- The project can be installed, built, and executed as a Node CLI.
- The command names are stable enough for later milestones.

### Milestone 2: Dependency Fact Extraction

Goal:

Extract deterministic dependency facts from TypeScript and JavaScript repositories.

Capabilities:

- Integrate or wrap `dependency-cruiser`.
- Produce a normalized internal dependency graph.
- Capture source files.
- Capture resolved internal imports.
- Capture external package usage.
- Capture unresolved imports.
- Capture dependency cycles.
- Preserve file-path evidence for reporting.
- Keep the internal graph independent of dependency-cruiser's raw output shape.

Validation:

- A fixture repo produces a stable graph.
- Internal and external dependencies are distinguishable.
- Cycles are detectable.
- Unresolved imports are visible.
- Analysis still has a controlled failure mode if dependency extraction fails.

Completion criteria:

- The rest of the system can operate on a normalized graph without knowing which tool produced it.

### Milestone 3: Architecture Rules Model

Goal:

Define the minimum rule model needed to describe intended boundaries.

Capabilities:

- Config file defines zones such as layers or modules.
- Zones map to files using path patterns.
- Rules define forbidden dependencies between zones.
- Optional allow rules may be supported, but forbid rules are enough for the first useful version.
- Rules include stable IDs.
- Rules include severity.
- Config validation produces actionable errors.
- Unclassified files are reported but do not crash analysis.

Validation:

- A fixture config can express a simple layered architecture.
- Invalid configs fail clearly.
- Files can be classified into zones.
- Duplicate or unknown zone references are rejected.

Completion criteria:

- A human can encode basic architectural intent without writing code.

### Milestone 4: Review Engine

Goal:

Compare dependency facts against declared architecture rules.

Capabilities:

- Evaluate each internal dependency edge against configured rules.
- Emit findings for violations.
- Include exact source and target evidence.
- Include source and target zones.
- Include finding fingerprints.
- Distinguish active findings from non-active findings once baselines and suppressions exist.
- Support severity.

Validation:

- A known-bad fixture produces expected findings.
- A known-good fixture passes.
- Findings are deterministic.
- Findings are specific enough for a developer to locate the issue.

Completion criteria:

- `review` can identify real architecture boundary violations in a TypeScript repo.

### Milestone 5: Report Output

Goal:

Make results useful to humans and automation.

Capabilities:

- Generate Markdown reports for human review.
- Generate JSON reports for tooling.
- Summarize counts by finding status and severity.
- List findings with exact file evidence.
- Include sections for cycles, unresolved imports, and unclassified files.
- Avoid generic architecture prose.

Validation:

- Markdown report is readable without knowing internal data structures.
- JSON report is stable enough for future CI use.
- Reports focus on concrete evidence.
- Reports distinguish active, baseline, and suppressed findings.

Completion criteria:

- A developer can run `review` and understand what needs attention.

### Milestone 6: Baselines and Suppressions

Goal:

Make the tool adoptable in legacy repositories.

Capabilities:

- Generate a baseline of existing finding fingerprints.
- Mark findings as known when they match the baseline.
- Allow suppressions with required rationale.
- Support a "new violations only" adoption mode.
- Report suppressed and baseline findings separately from active findings.

Validation:

- Existing violations can be recorded without failing future review.
- New violations can be detected independently.
- Suppressions are visible and auditable.
- Suppressions require a reason.

Completion criteria:

- A legacy repository can adopt Architecture Steward without first fixing every violation.

### Milestone 7: Tooling Export

Goal:

Bridge Architecture Steward rules into existing enforcement tools.

Capabilities:

- Export compatible forbidden dependency rules to dependency-cruiser.
- Clearly report rules that cannot be represented in a target tool.
- Keep Architecture Steward config as the authoring layer.
- Avoid silently changing rule meaning during export.

Validation:

- A simple Architecture Steward config produces a working dependency-cruiser config.
- Exported config catches the same basic boundary violations.
- Unsupported mappings are explicit.

Completion criteria:

- Teams can move from review reports toward existing CI enforcement tooling.

### Milestone 8: Discovery and Calibration

Goal:

Help users bootstrap architecture intent from an existing repo.

Capabilities:

- Detect likely modules or layers from directory structure.
- Summarize observed dependency directions.
- Identify cycles and suspicious cross-boundary dependencies.
- Suggest candidate zones and rules.
- Require human confirmation before suggestions become enforceable rules.
- Clearly distinguish facts from inferences.

Validation:

- Discovery helps create a first config faster.
- Suggested rules are clearly marked as suggestions.
- No discovered rule is enforced without human approval.
- Output distinguishes deterministic facts from inferred architecture.

Completion criteria:

- A user can point Architecture Steward at an existing repo and get useful starting material for a real config.

## Post-MVP Milestones

### AI-Assisted Review

Use AI only after deterministic findings exist.

Potential capabilities:

- Explain why a violation matters.
- Suggest small remediation paths.
- Draft PR review comments.
- Generate AGENTS.md guidance from confirmed rules.
- Draft ADRs from accepted human decisions.

Non-goal:

- AI must not generate rules that fail CI without human approval.

### Structural Architecture Rules

Add code-pattern checks beyond imports.

Potential tools:

- `ast-grep` for structural patterns.
- `ts-morph` for TypeScript-specific AST analysis.
- Semgrep-style rules if useful.

Example checks:

- Domain code must not instantiate database clients.
- UI code must not call persistence APIs directly.
- Server-only modules must not be imported by client code.
- Application services must not import React components.

### Presets

Add editable presets for common architectures and frameworks.

Potential presets:

- Next.js app router.
- React SPA.
- NestJS service.
- Express API.
- Modular monolith.
- Package-based monorepo.
- Feature-sliced frontend.
- Ports-and-adapters backend.

Presets should bootstrap configuration, not impose dogma.

### Additional Language Adapters

Add languages only after the TypeScript workflow proves useful in CI.

Likely order:

1. Java via ArchUnit-style integration.
2. Go via native package/dependency data.
3. Python via import graph tooling.
4. Dart/Flutter via analyzer tooling.

The core architecture model should remain language-neutral, but each language adapter should use native ecosystem tools where they are stronger than a universal parser.

### Organization-Level Governance

Later capabilities may include:

- Shared rule packs.
- Organization presets.
- Cross-repository architecture health.
- Ownership mapping.
- Trend reports.
- PR-level architecture review comments.

This is intentionally out of scope until the single-repository workflow is proven.

## Risks

### Becoming a Documentation Generator

If outputs are mostly architecture prose, users will try it once and ignore it.

Mitigation:

- Prioritize specific findings, exact evidence, and CI-compatible outputs.

### False Confidence From Inference

Architecture discovery can sound more authoritative than it is.

Mitigation:

- Separate facts, inferences, and human decisions.
- Require confirmation before enforcing discovered rules.

### Generic Recommendations

Advice like "use modular monolith" or "reduce coupling" is not useful by itself.

Mitigation:

- Focus reports on exact files, imports, rules, and remediation hints.

### TypeScript Resolution Edge Cases

Real repositories use aliases, package exports, generated code, barrels, framework conventions, and monorepo tooling.

Mitigation:

- Lean on `dependency-cruiser` and TypeScript ecosystem tools.
- Keep the graph model independent from any one analyzer.
- Add fixtures for resolution edge cases over time.

### Legacy Repo Overload

Existing repos may produce too many violations.

Mitigation:

- Support baselines, suppressions, and new-violations-only workflows early.

### Premature Polyglot Scope

Trying to support many languages before proving one workflow would dilute the product.

Mitigation:

- Make the core language-neutral, but keep MVP support TypeScript/JavaScript only.

## Acceptance Criteria For MVP

The MVP is complete when:

- A user can install and run the CLI.
- A user can generate or write a starter config.
- The CLI can analyze a TypeScript/JavaScript repository.
- The CLI can report forbidden dependency violations with exact evidence.
- Reports are available in Markdown and JSON.
- Existing violations can be baselined.
- Suppressions require rationale and are visible in reports.
- Active error findings can fail CI.
- dependency-cruiser export works for simple forbidden dependency rules.
- Discovery produces useful starting material without enforcing inferred rules.

## Current Implementation Status

Implemented:

- Project skeleton and CLI.
- Config loading and validation.
- Starter config generation.
- Dependency extraction using dependency-cruiser with built-in scanner fallback.
- Normalized dependency graph.
- Zone classification.
- Forbidden dependency review.
- Markdown and JSON reports.
- Baseline generation and matching.
- Suppressions with rationale.
- dependency-cruiser export.
- Basic discovery output.
- Unit tests for core review behavior.

Still needs hardening:

- More realistic TypeScript fixtures.
- Path alias fixtures.
- Monorepo/package boundary fixtures.
- Cycle-specific report tests.
- Unresolved import tests.
- New-violations-only CLI mode.
- Better discovery calibration output.
- Explicit unsupported-rule reporting in exporter.

## Suggested Next Steps

1. Harden Milestone 2 with realistic TypeScript dependency resolution fixtures.
2. Harden Milestone 5 with report snapshot or structure tests.
3. Complete Milestone 6 by adding an explicit new-violations-only review mode.
4. Improve Milestone 7 with unsupported export diagnostics.
5. Improve Milestone 8 so discovery suggests candidate config, not just candidate zones.
