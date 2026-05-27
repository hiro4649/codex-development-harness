<!-- CODEX_QUALITY_HARNESS_FILE v0.9.4 -->
# Codex Development Harness

Version: v0.9.4
Name: Remote Product Context Restore, Runtime Job Safety, and Evidence Lock Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.4 preserves v0.9.3 target hotfix preservation, product context fidelity, and runtime artifact assurance while adding remote product context restore, product-relevant evidence lock, product baseline continuity, skip-npm product bypass protection, pull-request context fidelity, product-context safe artifact classification, runtime job safety, tx path state evidence, env consistency, staging no-tx preflight, runtime log secret scan, chain scope guard, and false-positive budget tracking.

The new checks use deterministic fixtures and safe summaries. They add no external dependency, no LLM judge requirement, no MCP requirement, no browser or Playwright requirement, no hidden chain-of-thought inspection, no product command execution, and no product code change requirement.

## What v0.9.4 Adds

- Remote Product Context Restore Gate for preserving PR number, head/base SHA, changed files, product relevance, npm baseline, remote product baseline, and workflow_dispatch diagnostic-only state across the harness.
- Product-Relevant Evidence Lock and Product Baseline Continuity gates for preventing product PR pass states when product verification, remote baseline, npm baseline, or same-head evidence is missing.
- Skip NPM Product Bypass and Pull Request Context Fidelity gates so CODEX_SKIP_NPM and workflow_dispatch cannot substitute for PR-context product evidence.
- Product Context Safe Artifact Gate for compact classification of product context failures without raw logs, raw diffs, endpoints, or private data.
- Runtime Job Safety, Tx Path State Evidence, Env Consistency, Staging No-Tx Preflight, Runtime Log Secret Scan, and Chain Scope gates for lightweight runtime evidence locking without claiming runtime readiness.
- False Positive Budget Gate to measure body-only repair loops, near-miss headings, repeated evidence repairs, and artifact pending loops without weakening non-overridable failures.
- v0.9.4 deterministic self-test fixtures.

## Preserved v0.9.3 Capabilities

v0.9.4 keeps target hotfix preservation, target patch manifests, rollout conflict detection, remote product PR context fixtures, target script classification fixtures, same-head artifact evidence, Docker smoke current-head artifact enforcement, CODEX_SKIP_NPM product override protection, goal condition checks, review policy classification, and compact PR evidence.

## What v0.9.4 Does Not Add

No external memory server, MCP dependency, required LLM judge, GEPA or DSPy dependency, AST parser dependency, browser or Playwright requirement, external API call, prompt auto-apply, hidden chain-of-thought inspection, product command execution, product code changes, runtime readiness claim, production readiness claim, or target rollout is implemented by this source update.

## Running The Core Gate

Node.js 20 or newer is expected. The harness core uses Node.js standard library scripts and does not require npm dependencies. If `package.json` is absent, npm checks are not real verification.

```bash
CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

Profiles remain v0.7.0-compatible optional artifacts unless a downstream propagation task explicitly updates them.

## Target Repositories

Target repository installs use `docs/process/CODEX_HARNESS_MANIFEST.json`. They must not copy or depend on `CODEX_SOURCE_HARNESS_MANIFEST.json`, which is only for this source harness repository.

Target mode is explicit:

```bash
CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

`CODEX_SKIP_NPM=1` remains valid for harness-only changes with no runtime readiness claim. Product source, tests, specs, package, lockfile, runtime asset, config, Docker, or script-entrypoint changes require the matching product or runtime evidence.
