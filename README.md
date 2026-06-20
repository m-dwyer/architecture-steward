# Architecture Steward

Architecture Steward is a TypeScript-first architecture review CLI for existing JavaScript and TypeScript repositories.

It compares deterministic dependency facts from a repository against human-declared architecture intent and reports concrete boundary violations.

## Status

Initial MVP implementation.

## Quick Start

```sh
npm run build
node dist/src/cli.js init --target ./some-repo
node dist/src/cli.js review --target ./some-repo
```

## Config

Architecture Steward reads `architecture-steward.config.json` from the target repository by default.

```json
{
  "zones": [
    { "name": "ui", "patterns": ["src/ui/**"] },
    { "name": "domain", "patterns": ["src/domain/**"] },
    { "name": "infrastructure", "patterns": ["src/infrastructure/**"] }
  ],
  "rules": [
    {
      "id": "domain-no-infrastructure",
      "type": "forbid",
      "from": "domain",
      "to": "infrastructure",
      "severity": "error"
    }
  ],
  "suppressions": []
}
```

## Commands

- `init`: writes a starter config to stdout.
- `discover`: summarizes dependency facts and likely zones.
- `review`: evaluates dependency facts against architecture rules.
- `baseline`: writes current finding fingerprints to stdout.
- `export dependency-cruiser`: writes a dependency-cruiser config to stdout.

Use `--target <path>` to point at a repository and `--config <path>` to use a non-default config.
