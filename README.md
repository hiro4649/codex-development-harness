<!-- CODEX_QUALITY_HARNESS_FILE v0.9.8 -->
# Codex Development Harness

Version: v0.9.8
Name: Remote Product Evidence Execution, Phase-Safe Solvability, and Real Artifact Enforcement Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.8 preserves v0.9.7 operational regression locks while adding actual remote product evidence execution, evidence consumption enforcement, placeholder evidence rejection, local/remote phase-safe status, structured solvability fields, Live2D dataset row audit runner checks, motion allowlist diff checks, trusted loader evidence enforcement, avatar UX safety runner checks, runtime latency safe metrics, browser smoke visual safety artifacts, open PR rebase readiness, and five-line owner digest.

v0.9.8 is a real-artifact enforcement release. It closes the gap where product-relevant target PRs could appear locally healthy while remote npm execution, remote product evidence, remote baseline, remote npm diagnostic, or quality-gate consumption remained placeholder-only. Local pre-push validation and remote after-push evidence are treated as separate phases, and merge readiness stays blocked until real current-head remote evidence exists.

## What v0.9.8 Adds

- Remote Product Evidence Execution and Runner gates for final safe remote npm evidence, baseline, and diagnostic artifacts on product-relevant target PRs.
- Product Evidence Consumption and Placeholder Evidence Forbidden gates to prevent generated evidence from being ignored or pending placeholders from satisfying product verification.
- Local/Remote Phase Status and Structured Solvability Fields gates so readiness decisions use fixed fields instead of PR-body prose.
- Live2D Dataset Row Audit Runner, Motion Allowlist Diff, Trusted Loader Evidence Enforcer, Avatar UX Safety Runner, Runtime Latency Safe Metric, and Browser Smoke Visual Safety Artifact gates.
- Open PR Rebase Readiness and Five-Line Owner Digest gates.
- v0.9.8 deterministic self-test fixtures.

## Preserved Capabilities

v0.9.8 keeps v0.9.7 active self-test registry, workflow product verification invariant, target hotfix regression, blocker root-cause classification, structured solvability, Live2D dataset row audit, trusted loader evidence, owner decision digest, and all earlier AGENTS doctrine, skill routing, evidence minimality, skip-npm bypass protection, remote product context, runtime job safety, tx path evidence, env consistency, same-head evidence, and previous target hotfix preservation gates.

## What v0.9.8 Does Not Add

No external dependency, LLM judge requirement, MCP requirement, all-PR browser requirement, hidden chain-of-thought inspection, source self-test product command execution, product code change requirement, target rollout, runtime readiness claim, production readiness claim, Live2D real connection, dataset audit runner implementation in product repos, Game/Tool Adapter implementation, beloved avatar audit runner implementation, raw npm log artifact, raw cue artifact, raw motion command artifact, raw model path artifact, raw console log artifact, raw production data artifact, or workflow-dispatch-as-PR-check substitute is introduced by this source update.

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
