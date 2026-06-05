<!-- CODEX_QUALITY_HARNESS_FILE v1.0.8 -->

# Codex Harness v1.0.8

Theme: Evidence Closure and Orchestrated Repair.

This source-harness release preserves v1.0.7 safety guarantees and adds a
small set of generic gates for closing evidence loops, separating render and
publish operations, decomposing local/remote disagreement, isolating branch
lanes, and keeping agent orchestration advisory.

## Authoritative Evidence

- `.codex/evidence-pack.json` is the source of truth.
- Quality-gate artifacts are authoritative for audited run facts:
  `auditedHeadSha`, `auditedBaseSha`, `auditedPrBodySha256`, `sourceRunId`,
  and `artifactId`.
- PR bodies and docs are rendered outputs and must carry a generated marker.
- PR body run IDs are informational. They must not create a self-reference
  freshness loop.
- Manual edits to generated evidence sections fail rendered output drift.

## Modes

- `verify`: no mutation, CI-safe, explains missing or stale evidence.
- `render`: local file output only, no PR body update.
- `publish`: PR body mutation only with explicit `--pr` and explicit
  `--body-file`.

Publish is forbidden when the worktree is dirty, the current head differs from
the audited head, GitHub auth is unavailable, or the body-file hash does not
match rendered evidence.

## Operational Repair

The harness reports one safe next action. Local-pass/remote-fail cases emit a
delta instead of raw logs. Remote npm diagnostics cannot override formal
current-head evidence. Stale audit failures are decomposed by field.

## Isolation

Target harness execution must use isolated temporary worktrees for PR context
checkout. Parent branch, parent head, index, and tracked files must remain
unchanged. Cross-lane dirty files and protected patches stop work before
rollout or repair.

## Review And Orchestration

Review requests, writer-only reviews, bot-only comments, stale reviews, and
Codex operational comments are not independent human review evidence. Subagents,
local agents, and thread-to-thread sessions are advisory only. Parent harness
authority remains final.

## Non-Readiness Boundary

Fixture-only, scoping-only, candidate-only, and manual-gate-required features do
not imply runtime readiness, production readiness, production go, deploy
permission, or merge readiness.
