<!-- CODEX_QUALITY_HARNESS_FILE v0.8.0 -->
# Codex Development Harness

Version: v0.8.0
Name: Generic Core and Golden Evidence Gate

This repository contains reusable Codex quality gates, policies, and safe
evidence tooling. v0.8.0 focuses on a generic source harness core that can pass
without any downstream project profile, deterministic golden audit cases, clean
AGENTS.md persistent context, and practical evidence gates for real development.

## What v0.8.0 Adds

- Generic core mode: `CODEX_HARNESS_MODE=core`
- Optional profile compatibility: `CODEX_PROFILE_COMPAT_MODE=optional`
- AGENTS context validation
- Environment readiness validation
- Golden set regression fixtures
- Practical Best of N evidence checks
- Optional task queue lite validation
- Optional safe trace schema validation
- Report-only curator and offline evolution proposal gates
- Test coverage evidence and performance evidence gates when claims require them

## What v0.8.0 Does Not Add

No external memory server, Agentmemory dependency, MCP dependency, SQLite memory
layer, automatic skill rewriting, automatic commit, automatic push, required LLM
judge, GEPA optimizer, or self-evolving runtime is implemented.

## Running The Core Gate

Node.js 20 or newer is expected. The harness core uses Node.js standard library
scripts and does not require npm dependencies. If `package.json` is absent, npm
checks are not real verification.

```bash
CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

Profiles remain v0.7.0-compatible optional artifacts unless a downstream
propagation task explicitly updates them.

## Target Repositories

Target repository installs use `docs/process/CODEX_HARNESS_MANIFEST.json`.
They must not copy or depend on `CODEX_SOURCE_HARNESS_MANIFEST.json`, which is
only for this source harness repository.
