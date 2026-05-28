<!-- CODEX_QUALITY_HARNESS_FILE v0.9.6 -->
# Codex Development Harness

Version: v0.9.6
Name: Spec Coverage, Runtime Adoption, Migration Safety, and Human Digest Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.6 preserves v0.9.5 AGENTS doctrine, skill routing, skill budget, evidence minimality, evidence dedup, and safe artifact next action while adding K-rule coverage, Live2D spec sync, runtime latency budget, obsolete open PR hygiene, compact owner summaries, browser smoke artifact checks, failure-to-repair planning, runtime state adoption, claim/timeout/tx reconciliation gates, migration rollout safety, dataset audit readiness, Game/Tool Adapter contract fixtures, beloved avatar safety audit readiness, and human review digests.

The new checks use deterministic fixtures and safe summaries. They add no external dependency, no LLM judge requirement, no MCP requirement, no all-PR browser requirement, no Playwright requirement, no hidden chain-of-thought inspection, no product command execution, and no product code change requirement. Browser smoke evidence stays optional and scoped, and a passing browser smoke cannot be treated as runtime readiness.

## What v0.9.6 Adds

- K Rule Coverage and Live2D Spec Sync gates for keeping spec coverage and phase boundaries explicit without connecting real Live2D runtime.
- Runtime Latency Budget, Runtime State Adoption, Claim Transition, Timeout Adoption, Tx Reconciliation Service, TxHash Before Wait, and Receipt Resume Boundary gates for runtime adoption evidence without claiming runtime readiness.
- Migration Rollout Safety and Migration Runtime Compatibility gates for additive migration safety and rollback/compatibility evidence.
- Owner Summary Compact, Human Review Digest, Failure to Repair Plan, Browser Smoke Artifact, and Obsolete Open PR gates for shorter human-facing evidence and safer next actions.
- Dataset Audit Readiness, Game/Tool Adapter Contract Fixture, and Beloved Avatar Safety Audit gates for safe audit and adapter readiness without raw data or auto-fix behavior.
- v0.9.6 deterministic self-test fixtures.

## Preserved v0.9.5 Capabilities

v0.9.6 keeps AGENTS doctrine control, skill routing, skill load budget, skill drift detection, agent session governance, agent containment boundary checks, eval trace harvesting, operator-visible delta evidence, subagent governance, state machine schema evidence, state transition helper checks, receipt evidence schema, worker readiness sequence, evidence minimality, evidence dedup, safe artifact next-action classification, and skill evidence links. It also preserves v0.9.4 remote product context restore, product evidence lock, runtime job safety, tx path evidence, env consistency, and skip-npm bypass protection.

## What v0.9.6 Does Not Add

No external memory server, MCP dependency, required LLM judge, GEPA or DSPy dependency, AST parser dependency, all-PR browser or Playwright requirement, external API call, prompt auto-apply, hidden chain-of-thought inspection, product command execution, product code changes, runtime readiness claim, production readiness claim, raw runtime log artifact, raw cue artifact, raw motion command artifact, raw model path artifact, raw production trace artifact, dataset auto-fix behavior, or target rollout is implemented by this source update.

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
