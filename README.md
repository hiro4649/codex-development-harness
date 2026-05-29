<!-- CODEX_QUALITY_HARNESS_FILE v0.9.9 -->
# Codex Development Harness

Version: v0.9.9
Name: Evidence Precedence, Lifeboat Semantics, Actions Recovery, and Dataset Safety Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.9 preserves v0.9.8 remote product evidence and structured solvability gates while adding formal evidence precedence, lifeboat semantics, placeholder-only rejection, remote npm diagnostic normalization, legacy self-test advisory handling, auth surface classifier refinement, target quality blocker digest, PR evidence auto-repair hints, Actions blocker recovery, PR-context rerun assistance, same-head evidence refresh, safe artifact bundle completeness, dataset audit v2 P0 schema, Game Tool Adapter fixture readiness, and beloved avatar safety readiness.

v0.9.9 is an operational recovery release. It keeps product evidence failures blocking while avoiding false failures from standby lifeboats or superseded pending placeholders when formal same-head remote evidence exists. Actions failures before job startup are classified separately from product failures, and merge readiness stays blocked until same-head remote pass evidence exists.

## What v0.9.9 Adds

- Formal Evidence Precedence, Lifeboat Semantics, Placeholder-Only Evidence, and Remote NPM Diagnostic Normalization gates.
- Legacy Self-Test Advisory, Auth Surface Classifier Refinement, Target Quality Blocker Digest, and PR Evidence Auto-Repair Hint gates.
- Actions Blocker Recovery, PR Context Rerun Assistant, Same-Head Evidence Refresh, and Safe Artifact Bundle Completeness gates.
- Dataset Audit v2 P0 schema, Game Tool Adapter fixture readiness, and beloved avatar safety readiness gates.
- v0.9.9 deterministic self-test fixtures.

## Preserved Capabilities

v0.9.9 keeps v0.9.8 remote product evidence execution, product evidence consumption, placeholder evidence forbidden, structured solvability fields, open PR rebase readiness, five-line owner digest, and all earlier active self-test registry, workflow product verification invariant, target hotfix regression, blocker root-cause classification, AGENTS doctrine, skill routing, evidence minimality, skip-npm bypass protection, remote product context, runtime job safety, same-head evidence, and previous target hotfix preservation gates.

## What v0.9.9 Does Not Add

No external dependency, LLM judge requirement, MCP requirement, all-PR browser requirement, hidden chain-of-thought inspection, source self-test product command execution, product code change requirement, target rollout, runtime readiness claim, production readiness claim, Live2D real connection, dataset audit runner implementation in product repos, Game/Tool Adapter runtime implementation, beloved avatar audit runner implementation, raw npm log artifact, raw diff artifact, raw cue artifact, raw motion command artifact, raw model path artifact, raw console log artifact, raw production data artifact, or workflow-dispatch-as-PR-check substitute is introduced by this source update.

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
