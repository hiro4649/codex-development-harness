# Codex Harness v1.1.5 Spec

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.5 -->

## Theme

Trace Kernel, Policy Hooks, Skill Profiles, and Token-Thin Finalizer.

## Purpose

v1.1.5 preserves the v1.1.4 Decision Core safety profile while reducing repeated
operator explanations, repeated validation, PR body repairs, legacy
compatibility repairs, and token-heavy closeouts.

## Operator-Visible Statuses

- `traceKernelStatus`
- `policyHookContractStatus`
- `goalContractStatus`
- `skillProfileRegistryStatus`
- `permissionProfileMatrixStatus`
- `targetFinalizerStatus`
- `legacyCompatibilityMatrixStatus`
- `tokenRuntimeMeterStatus`
- `validationDependencyGraphStatus`
- `decisionCoreV2Status`

## Decision Core v2

`decisionCore.safe.json` is the authoritative machine decision source. Minimal
Blockers supports it, but cannot override it. PR bodies are rendered human
summaries and cannot be the sole machine source of truth.

## Trace Kernel

Trace records store compact safe pointers only: repo, branch, head, task mode,
loop state, decision, primary class, safe next action, hashes, token cost,
elapsed time, and explicit `rawLogsRead: false` / `eightSessionUsed: false`.
Trace records must not contain raw logs, full stdout, full JSON, secret-like
values, private URLs, private path details, pass status lists, or long boundary
text.

## Policy Hooks

`preToolPolicy`, `postToolPolicy`, and `stopPolicy` fail closed. They block raw
logs, 8-session usage, wallet/RPC/deploy access, package or workflow changes
outside explicit scope, product file changes during harness rollout, unsafe
repo-external writes, unpreserved deletion, and missing Decision Core closeout.

## Skill And Permission Profiles

Conversation and PR bodies should show profile IDs and overrides only. Full
forbidden lists live in `CODEX_V115_PROFILE_REGISTRY.json`.

## Target Finalizer

Target rollout packages must finalize target-aware metadata during rollout:
target AGENTS wording, `sourceOnlyRelease: false`, `targetRollout: completed`,
`targetRepoMode: true`, `activeHarnessVersion: 1.1.5`,
`targetHarnessVersion: 1.1.5`, `activeSelfTestSuite: v115`, and
`activeSelfTestStatusKey: v115SelfTestStatus`.

## Legacy Compatibility Matrix

Target mode shadows v080-v109 legacy checks count-only unless a true blocker is
present. Source mode can keep source-only hard checks. Secret, product,
runtime, production, package/lockfile, workflow, raw-log, wallet/RPC/deploy,
legal, and YouTube compliance blockers remain hard.

## Token Runtime Meter

Normal final reports target 12 lines, target rollout final reports target 20
lines, normal stdout targets 30 lines, PR bodies target 8 KB, minimal blockers
target 3 KB, pass status lists are elided, and repeated boundary text is capped.

## Non-Goals

No target rollout, product implementation, runtime integration, package or
lockfile change, workflow expansion, raw-log access, 8-session operation, or
readiness claim is introduced by the v1.1.5 source body.
