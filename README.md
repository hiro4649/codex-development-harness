<!-- CODEX_QUALITY_HARNESS_FILE v1.0.1 -->
# Codex Development Harness

Version: v1.0.1
Name: Outcome Contract, Plan Reviewer Workers, Anti-Accretion, Visible Acceptance Evidence, and Local Gate Contract Hardening

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v1.0.1 preserves v1.0.0 parent harness discipline, runtime readiness boundary, production go boundary, and v0.9.9 evidence precedence, lifeboat semantics, placeholder-only rejection, remote npm diagnostic normalization, legacy self-test advisory handling, target quality blocker digest, PR evidence auto-repair hints, Actions recovery, same-head evidence refresh, and safe artifact bundle completeness.

v1.0.1 adds outcome contract, plan reviewer workers, anti-accretion, visible acceptance evidence, toolchain preflight, branch/head invariants, same-head main quality-gate evidence, local gate JSON report contract, local gate side-effect guard, small product PR fast path, self-test fixture isolation, authoritative product evidence, target owner action classification, and runtime adoption sequence.

## What v1.0.1 Adds

- Outcome contract and source-of-truth ownership gates before product behavior changes.
- Plan reviewer worker and anti-accretion gates to catch wrong owner, missing cutover, and dual active path risk.
- Visible acceptance evidence gates that distinguish acceptance evidence from runtime readiness and production readiness.
- Toolchain, parent harness, local branch, target HEAD, same-head main quality-gate, and pilot cleanliness gates.
- Local gate JSON report contract and side-effect guard so `CODEX_QUALITY_REPORT=json` is machine-readable even for failures.
- Small product PR fast path, self-test fixture isolation, authoritative product evidence, target owner action classification, and runtime adoption sequence gates.

## What v1.0.0 Adds

- Parent harness gates: v0.9.9 remains the stable parent while v1.0.0 adds v100 self-test coverage.
- Dynamic workflow gates for plan, DAG, scope, worker budget, branch isolation, file ownership, role matrix, evidence aggregation, merge order, stop/resume, and cost budget.
- Application intelligence gates for codebase maps, entrypoints, module boundaries, dependency/data/API/DB/worker/integration/security/performance/cost maps, dead-code candidates, test gaps, docs drift, confidence, handover, and backlog planning.
- Safe execution gates for cleanup, behavior preservation, refactor slices, public contracts, migration safety, runtime readiness boundaries, and production go boundaries.

## What v1.0.0 Does Not Add

No external dependency, LLM judge requirement, MCP requirement, all-PR browser requirement, hidden chain-of-thought inspection, source self-test product command execution, product code change requirement, target rollout, runtime readiness claim, production readiness claim, unlimited subagent execution, product implementation, dataset audit runner implementation, Game/Tool Adapter runtime implementation, beloved avatar audit runner implementation, migration auto-apply, dead-code deletion without confirmation, or cost/performance claims without evidence is introduced by this source update.

## Running The Core Gate



Node.js 20 or newer is expected. The harness core uses Node.js standard library scripts and does not require npm dependencies. If `package.json` is absent, npm checks are not real verification.



~~~bash

CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs

~~~



Profiles remain v0.7.0-compatible optional artifacts unless a downstream propagation task explicitly updates them.



## Target Repositories



Target repository installs use `docs/process/CODEX_HARNESS_MANIFEST.json`. They must not copy or depend on `CODEX_SOURCE_HARNESS_MANIFEST.json`, which is only for this source harness repository.



Target mode is explicit:



~~~bash

CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs

~~~



`CODEX_SKIP_NPM=1` remains valid for harness-only changes with no runtime readiness claim. Product source, tests, specs, package, lockfile, runtime asset, config, Docker, or script-entrypoint changes require the matching product or runtime evidence.
