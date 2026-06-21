# Architecture Steward

Architecture Steward is a TypeScript-first architecture review CLI for existing JavaScript and TypeScript repositories.

It compares deterministic dependency facts from a repository against human-declared architecture intent and reports concrete boundary violations.

## Status

Initial MVP implementation.

## Quick Start

Tooling is pinned with [mise](https://mise.jdx.dev) (Node + pnpm) and there is no
build step — the CLI runs straight from TypeScript via Node's native type
stripping.

```sh
mise install        # provisions Node 24 + pnpm 10
pnpm install        # installs dependencies
archie init --target ./some-repo
archie review --target ./some-repo
```

`mise` puts the project's `bin/` on your `PATH` while you're in this directory,
so `archie` is available directly. Outside the directory (or without mise) use
`pnpm archie <command>` or `node src/cli.ts <command>`.

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
Run `archie --help` (or `archie <command> --help`) for full usage, and `archie --version`.

## Shell Completion (zsh)

`archie` ships tab completion for commands and flags (powered by yargs). Because
mise only puts `archie` on your `PATH` inside this project, completion is
effectively scoped to this directory: it lights up here and stays quiet
elsewhere. One-time setup:

```sh
mkdir -p ~/.zsh/completions
archie completion > ~/.zsh/completions/_archie
```

Then make sure your `~/.zshrc` loads that directory *before* `compinit`:

```sh
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

Open a new shell, `cd` into the project, and `archie <TAB>` will complete
commands, while e.g. `archie review --<TAB>` completes flags. (bash works too —
append `archie completion` to `~/.bashrc` instead.)

## Fixture Smoke Test

The repository includes a tiny intentionally bad TypeScript project:

```sh
archie discover --target test/fixtures/tiny-bad-repo
archie review --target test/fixtures/tiny-bad-repo
```

The review should report `src/domain/order.ts` importing `src/infrastructure/db.ts`, which violates the fixture's `domain-no-infrastructure` rule.
