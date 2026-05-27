<!-- CODEX_QUALITY_HARNESS_FILE v0.9.3 -->
# Codex Development Harness

Version: v0.9.3
Name: Target Hotfix Preservation, Product Context Fidelity, and Runtime Artifact Assurance Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.3 preserves v0.9.2 evidence automation, security lifecycle, review independence, and version lineage while adding target hotfix preservation, target patch manifests, rollout conflict detection, remote product PR context fixtures, target script classification fixtures, same-head artifact evidence, Docker smoke current-head artifact enforcement, CODEX_SKIP_NPM product override protection, goal condition checks, review policy classification, and compact PR evidence.

The new checks use deterministic fixtures and safe summaries. They add no external dependency, no LLM judge requirement, no MCP requirement, no browser or Playwright requirement, no hidden chain-of-thought inspection, no product command execution, and no product code change requirement.

## What v0.9.3 Adds

- Target Hotfix Preservation Gate to avoid silently overwriting target hotfixes, target-specific adaptations, or pre-existing harness-managed changes during rollout.
- Target Patch Manifest support for target-owned harness adaptations in `docs/process/CODEX_TARGET_PATCH_MANIFEST.json`.
- Target Rollout Conflict Gate for deleted target-only policies, missing stash or patch references, and target manifest regression.
- Remote Product PR Context fixtures to ensure product-relevant target PRs cannot pass with `CODEX_SKIP_NPM=1`, missing remote product evidence, or workflow_dispatch-only substitutes.
- Target Script Classification fixtures for `scripts/codex-*`, `scripts/run-tests.js`, `scripts/dev-server.js`, and unknown target scripts.
- Same-Head Artifact Evidence Gate for PR head, evidence pack, manual confirmation, remote run, artifact, safe summary, and local HEAD consistency.
- Docker Smoke Current-Head Artifact Gate for Docker-relevant changes.
- Target CODEX_SKIP_NPM Product Override Gate to keep harness-only skips separate from product verification.
- Goal Condition Gate for measurable end state, proof command, must-not-change list, stop condition, and max scope.
- Review Policy Classifier to scale review independence by risk class.
- PR Evidence Compact Gate to keep PR bodies short and move detail into safe artifacts.
- v0.9.3 deterministic self-test fixtures.

## Preserved v0.9.2 Capabilities

v0.9.3 keeps version lineage, PR evidence rendering, safe artifact classification, security lifecycle checks, review independence, task brief compilation, Best-of-N decision records, environment profiles, AGENTS context budget control, and evidence auto-repair hints.

## What v0.9.3 Does Not Add

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
