# Codex HARNESS v1.3.0 Spec

CODEX_QUALITY_HARNESS_FILE v1.3.0

Source HARNESS v1.3.0: Verified Goal Intake, Adaptive Capability Escalation,
and Transactional Agent Teams.

v1.3.0 is the active Source HARNESS release. v1.2.9 / v129 remains immediate
rollback authority. v1.3.0 target rollout is not started.

## Authority

Final Decision remains the only final pass, block, mergeAllowed, and exit-code
authority. Decision Capsule remains domain decision authority. Evidence Capsule
remains same-head and freshness authority. Safe Summary remains
non-authoritative. PR body remains display-only.

Model choice, agent role, Skill selection, Plugin selection, benchmark result,
and reviewer output never create authority. A protected executor may perform
exact-head execution only under standing delegation and required-check evidence.

## Machine Sources

The normative v1.3.0 machine policy is
`docs/process/CODEX_V130_POLICY.json`.

The normative v1.3.0 machine schema catalog is
`docs/process/CODEX_V130_SCHEMA.json`.

This Markdown file is explanatory and must not duplicate machine conditions in a
way that weakens the JSON policy.

## Pipeline

User intent is compiled into a bounded Session Intent Capsule, then into an
immutable Goal Contract. Project profiling is read-only. Loop admission routes
simple work to single-shot execution and rejects or constrains unsuitable work.
The minimum sufficient team is selected from a protected role registry. Worker
and verifier roles are incompatible when independence is required.

Baseline modes are execution states only: `green_required`,
`known_red_repair`, `bootstrap_generate_only`, and `not_applicable`. Benchmark
modes are separate and cannot be treated as baseline modes. Stop priority is
authority, safety, scope, regression, observation validity, baseline
contradiction, success, repair exhaustion, no progress, then budget exhaustion.
Progress-vector scoring is separate from stop priority.

Agent roles are compiled from role profiles plus explicit per-role deltas. A
compiled role must include sandbox, network, tools, write scope, output schema,
timeouts, byte limits, tool-call limits, spawn permission, and
`authorityCreated=false`.

Adaptive escalation is allowed at most once per Goal version and only for
reasoning, capability, or domain mismatch classes. Escalation is forbidden for
authority, safety, scope, provider transient, tool, and environment drift
classes.

## Token Economy

Routine cold artifact reads remain zero. Routine Skill selection is zero.
Routine subagent count is zero. The Safe Summary budget remains 5600 bytes,
routine read surface remains 2500 bytes, and Orchestration Capsule budget
remains 48000 bytes.

## Security Routing

Security scan and remediation tasks use four-eye separation. Cyber capability
selection requires verified defensive scope, repository ownership, candidate
head binding, Goal digest binding, approved model inventory, trusted access, and
an independent verifier. If unavailable, the state is explicit and non-silent.

## Activation

Activation keeps targetHarnessVersion at v1.2.9 and targetRollout not_started.
