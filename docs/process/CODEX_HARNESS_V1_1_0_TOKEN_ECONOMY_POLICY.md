<!-- CODEX_QUALITY_HARNESS_FILE v1.1.0 -->

# Codex Harness v1.1.0 Token Economy and Operational Closure Policy

## Purpose

v1.1.0 reduces operator-visible token volume while preserving v1.0.9 safety,
evidence quality, same-head verification, failure triage, repair-plan safety,
and product/runtime boundaries.

## Retained v1.0.9 Guarantees

- Decision Ledger, Gate Ledger, Failure Triage, Repair Plan, CI Watcher, and
  required check closure remain enforced.
- Runtime readiness and production readiness remain false unless explicit real
  evidence and owner-approved scope exist.
- Product/harness separation, review independence, manual gate boundaries,
  safe artifact enforcement, raw log prohibition, and parent final authority
  are preserved.
- v1.0.9 statuses remain recognized through a v1.1.0 absorption map.

## New v1.1.0 Status Areas

- Pro Summary First, Detail on Demand, Delta Only Reporting.
- Token Budget Gate and Session Budget Gate.
- Decision Ledger File, Gate Ledger File, Stop/Resume Contract.
- CI Watcher V2 and Active Harness Reconciliation.
- Short Codex Instruction Compiler with standing policy references.
- Structured Evidence First, PR body as rendered output, body schema
  normalization, and body repair hints.
- PR Inventory Reduction Engine and Main Reflection Package Builder.
- Review Evidence Protocol V3 and Runtime Return Gate V2.
- Forbidden Content Scanner V2 and Readiness Language Linter V2.
- No Deploy Proof Artifact, VGC token stage artifact, owner values workflow,
  and deploy approval state machine.
- Runtime readiness blocker digest, Live2D critical invariants, performance
  budget v2, operator effort score, output volume score, session efficiency
  score, and precision preservation.

## Output Modes

`summary` is the default and emits a short Pro Summary:

- state
- hard blocker
- allowed now
- forbidden now
- one safe next action
- readiness
- detail artifact

`standard` adds blocker class, changed state, required check closure, and
repair category.

`detail` emits the full status matrix, ledgers, diagnostics, taxonomy, and
compatibility mapping.

## Token Budget Gate

The token budget gate classifies instruction and output bloat, not model
billing. It blocks summary status floods, repeated pass statuses, repeated
boundary text, competing safe next actions, no-delta new PR instructions, and
eight-session mode without an explicit exception gate. It must not suppress
hard blockers, required check failures, or readiness claim violations.

## Session Budget Gate

The default operating shape is main thread plus one verifier. High-risk work
may add a refutation verifier. Up to eight sessions requires explicit owner
instruction, clear goal, exit criteria, role ledger, worktree isolation when
files may mutate, parent final authority, advisory-only subagents, no subagent
merge authority, no local secret access, and no wallet/RPC/deploy access.

## Machine-Readable Artifacts

Decision Ledger file: `.codex/decision-ledger.safe.json`.

Gate Ledger file: `.codex/gate-ledger.safe.json`.

Stop/Resume contract: `.codex/stop-resume.safe.json`.

Body repair hint: `.codex/body-repair-hint.safe.json`.

Main reflection package: `.codex/main-reflection-package.safe.json`.

No deploy proof: `.codex/no-deploy-proof.safe.json`.

All artifacts are safe-summary only and must not contain raw logs, secrets,
private paths, wallet/RPC values, DB rows, tx hashes, viewer data, memory data,
model paths, motion paths, or provider errors.

## Short Codex Instruction Compiler

Compressed instructions use this shape:

- role
- target
- goal
- allowed
- forbidden
- validation
- stop condition
- final report

Standing policy and repo boundary references are preferred over repeated long
boundary text. Dangerous actions still require explicit forbidden actions.

## Precision Preservation Gate

v1.1.0 must preserve same-head enforcement, safe artifacts, raw log
prohibition, runtime and production readiness boundaries, product/harness
separation, review independence, manual gate boundary, failure triage, repair
plan, required check closure, secret redaction, wallet/RPC/deploy boundary, and
parent final authority.

## Non-Goals

- Target rollout is not started.
- No target repositories are touched.
- No product code changes.
- No runtime implementation.
- No production implementation.
- No provider, API, wallet, RPC, or deploy access.
- No actual DB export, resident evidence collection, trusted loader enablement,
  motion dataset execution, YouTube live operation, legal compliance claim,
  production go, or default eight-session execution.

