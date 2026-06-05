<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->

# Codex Harness v1.0.7 GEAR Policy

Codex Development Harness v1.0.7 adds Goal, Evidence, Agent Runtime, and
Real-PR Replay Governance as source-harness-only controls.

## Boundaries

- Target rollout remains `not_started`.
- Representative live PR validation remains `not_started`.
- Representative real PR replay is sanitized fixture replay only.
- Runtime readiness and production readiness remain false unless separately
  proven by the required gates.
- Local agents, subagents, Goose-like agents, extension tools, and
  thread-to-thread conversations are advisory only.
- Parent harness authority is required for approval, merge, readiness, deploy,
  and active harness promotion.
- No raw logs, raw diffs, raw PR body text, raw ASR audio, raw transcripts, raw
  memory contents, raw tool outputs, provider payloads, wallet data, endpoints,
  or secrets may be persisted.

## Required Status Families

The active source gate must emit `v107SelfTestStatus` and the v1.0.7 status
families listed in `CODEX_V107_STATUS_SCHEMA.json`. Every status uses the typed
status contract:

- `status`
- `blocking`
- `reasonCodes`
- `evidenceConsumed`
- `safeSummary`
- `nextSafeAction`
- `safeSummaryOnly`

Plain `not_run` is not an allowed status. Missing, absent, stale, or pending
remote checks cannot support merge readiness.

## Evidence Pack v3

`.codex/evidence-pack.json` is the source of truth for PR body rendering,
risk/manual-gate summaries, quality evidence, and test summaries. PR body text
is display output only. Hand-written PR body evidence is advisory.

## Agent Runtime Governance

Permission modes are bounded:

- `chat_only`: no tool writes and no shell.
- `advisory`: read-only analysis only.
- `approve`: bounded write only with parent approval.
- `smart_approve`: bounded and policy-mediated only.
- `autonomous`: disposable sandbox only; no secrets, deploy, merge, or
  readiness authority.

## Trace, Moderation, and ASR

Production or PR trace findings must flow through safe trace, reviewed finding,
eval target, regression fixture, work packet, candidate PR, and validation.
Moderation is a routing signal, not absolute approval. ASR is schema-only in
v1.0.7 and requires transcript provenance before any transcript is treated as
safe evidence.
