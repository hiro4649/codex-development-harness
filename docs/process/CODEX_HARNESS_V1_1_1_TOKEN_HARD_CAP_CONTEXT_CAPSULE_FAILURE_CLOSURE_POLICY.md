<!-- CODEX_QUALITY_HARNESS_FILE v1.1.1 -->

# Codex Harness v1.1.1 Token Hard Cap, Context Capsule, and Failure Closure Policy

## Purpose

v1.1.1 materially reduces token consumption while preserving precision, safety,
and development performance. It replaces long chat replay with safe artifacts,
keeps hard blockers visible, and closes terminal blocked harness-only rollouts
without product repair creep.

## Operating Rules

- Use Context Capsule before replaying long thread history.
- Use artifact pointers, run IDs, PR IDs, and safe reason codes instead of raw
  artifact content.
- Use summary mode by default. Detail and audit modes require explicit request.
- Do not create a new PR unless a state delta exists and existing ledgers cannot
  absorb the update.
- Do not rerun failed CI or read raw logs without state delta and explicit safe
  scope.
- Do not repair product failures inside harness-only rollout scope.
- Treat terminal blocked cache as active until head SHA, run metadata, safe
  artifact, or owner scope changes.
- Keep same-head checks, required check closure, and safe artifact requirements
  blocking.

## Session Control

Default operation is main thread only. Normal verification may use main plus one
verifier. High-risk work may use main, verifier, and refutation. Eight-session
operation is denied by default and requires explicit owner exception, role
ledger, exit criteria, unique role purposes, one fan-in summary, no duplicate
investigation, worktree isolation for mutating sessions, parent final authority,
advisory-only subagents, no subagent merge authority, no local secret access,
and no wallet/RPC/deploy access.

## Terminal Blocked Closure

When same-head required CI fails and safe artifact metadata says
`product_code_failure: true`, the harness rollout PR is not merge-ready. The
operator must not read raw logs, must not repair product code inside the harness
rollout, must not rerun without state delta, and must either close or record the
PR as terminal blocked according to repo policy. Future repair requires a
separate owner-authorized product scope.

## Target-Mode Legacy Compatibility

Target-mode rollout gates must classify legacy status surfaces explicitly.
Absorbed v1.1.0 and v1.0.9 statuses are nonblocking only when their v1.1.1
replacement status is present. Legacy self-test lineage is advisory unless the
current policy marks it blocking, and it never substitutes for
`v111SelfTestStatus`. Unsafe output, raw logs, same-head failures, required
check failures, readiness claims, forbidden product changes, self approval,
self merge, subagent merge authority, wallet/RPC/deploy access, and 8-session
default violations remain hard blockers.

## Precision Parity

Summary, macro instruction, and Context Capsule decisions must preserve the same
hard blocker, allowed now, forbidden now, one safe next action, readiness, merge
allowed decision, product repair allowed decision, and raw log access decision
as full detail mode.
