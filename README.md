<!-- CODEX_QUALITY_HARNESS_FILE v0.8.1 -->
# Codex Development Harness

Version: v0.8.1
Name: Target Verification and Context Integrity Gate

This repository contains reusable Codex quality gates, policies, and safe
evidence tooling. v0.8.1 focuses on a generic source harness core that can pass
without any downstream project profile, whole-file AGENTS.md context integrity,
target change classification, and product verification rules that distinguish
harness-only updates from product-relevant changes.

## What v0.8.1 Adds

- Generic core mode: `CODEX_HARNESS_MODE=core`
- Optional profile compatibility: `CODEX_PROFILE_COMPAT_MODE=optional`
- AGENTS context integrity validation across the whole file
- Environment readiness validation
- Golden set regression fixtures
- Target change classification
- Product verification policy for `CODEX_SKIP_NPM`
- Target quality score
- Practical Best of N evidence checks
- Optional task queue lite validation
- Optional safe trace schema validation
- Report-only curator and offline evolution proposal gates
- Test coverage evidence and performance evidence gates when claims require them

## What v0.8.1 Does Not Add

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

Target mode is explicit:

```bash
CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

`CODEX_SKIP_NPM=1` remains valid for harness-only changes with no runtime
readiness claim. Product source, tests, specs, package, lockfile, runtime asset,
or config changes require product verification evidence.
