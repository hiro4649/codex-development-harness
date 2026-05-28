<!-- CODEX_QUALITY_HARNESS_FILE v0.9.7 -->
# Codex Development Harness

Version: v0.9.7
Name: Operational Regression Lock, Dataset Runtime Sync, and Trusted Evidence Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.7 preserves v0.9.6 spec coverage, Live2D spec sync, runtime latency budget, owner summaries, browser smoke artifact checks, failure repair planning, runtime state adoption, migration safety, and human review digest behavior while adding operational regression locks for active self-test registration, workflow product verification invariants, target hotfix preservation, rollout diff regression, blocker root-cause classification, local/remote evidence phase separation, structured solvability, Live2D dataset row audit, motion allowlist sync, trusted loader evidence, Live2D evidence collector contracts, avatar UX safety, runtime latency measurement, browser smoke JSON artifacts, owner decision digests, obsolete PR auto recommendation, dataset audit v2 schema checks, Game/Tool Adapter contract fixtures, and beloved avatar safety audit readiness.

v0.9.7 is intentionally a lock-and-evidence release. It first protects the P0 paths that can regress product verification, active self-test registration, target hotfixes, and workflow artifact uploads. The Live2D, IRIS, and FUNKY oriented checks remain lightweight fixture and schema gates; they do not connect a real renderer, implement dataset audit runners, implement Game/Tool Adapter handoff, or claim runtime readiness.

## What v0.9.7 Adds

- Active Self-Test Registry and Workflow Product Verification Invariant gates to keep the current self-test and remote product evidence path registered.
- Target Hotfix Regression and Harness Rollout Diff Regression gates to catch source sync that drops target patches, product verification steps, or artifact upload paths.
- Blocker Root-Cause, Local/Remote Evidence Phase, and Structured Solvability gates to keep repair direction and merge readiness explicit.
- Live2D Dataset Row Audit, Motion Allowlist Sync, Trusted Loader Evidence, Live2D Evidence Collector Contract, Avatar UX Safety, Runtime Latency Measurement, and Browser Smoke JSON Artifact gates for safe runtime-adjacent evidence without raw cue, motion command, model path, console log, endpoint, private path, or production data output.
- Owner Decision Digest, Obsolete PR Auto Recommend, Dataset Audit v2, Dataset Audit Runner Readiness, Game/Tool Adapter Contract Fixture, and Beloved Avatar Safety Audit gates.
- v0.9.7 deterministic self-test fixtures.

## Preserved Capabilities

v0.9.7 keeps the v0.9.6 K-rule coverage, Live2D spec sync, runtime latency budget, owner summary compactness, browser smoke artifact, failure-to-repair plan, runtime state adoption, claim/timeout/tx reconciliation, migration rollout safety, migration runtime compatibility, human digest, dataset audit readiness, Game/Tool Adapter fixture, and beloved avatar safety readiness gates. It also preserves v0.9.5 AGENTS doctrine, skill routing, skill budget, evidence minimality, evidence dedup, and safe artifact next action, plus v0.9.4 remote product context, product evidence lock, runtime job safety, tx path evidence, env consistency, and skip-npm bypass protection.

## What v0.9.7 Does Not Add

No external dependency, LLM judge requirement, MCP requirement, all-PR browser requirement, Playwright requirement, hidden chain-of-thought inspection, product command execution, product code change requirement, target rollout, runtime readiness claim, production readiness claim, Live2D real connection, dataset audit runner implementation, Game/Tool Adapter implementation, beloved avatar audit runner implementation, raw runtime log artifact, raw cue artifact, raw motion command artifact, raw model path artifact, raw console log artifact, raw production data artifact, dataset auto-fix behavior, or workflow-dispatch-as-PR-check substitute is introduced by this source update.

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
