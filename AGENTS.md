# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.0.6

## Prime Directive

Ship the smallest correct change that increases product value without weakening
truth, trust, security, or maintainability.

## Source Harness Boundary

This repository is the Codex Development Harness source. Work here must stay in
the harness itself unless a task explicitly names a downstream project. Do not
change downstream project repositories from source harness work.
Use `docs/process/CODEX_OPENAI_CODEX_METHOD_POLICY.md` and
`docs/process/code_review.md` as the stable method references.
For v1.0.1 through v1.0.3 outcome, recovery, fixture isolation, clean-main,
judgment consistency, product surface routing, review taxonomy, stale input,
external blocked, handover, branch/head, and local gate contract routing, use
the matching `docs/process/CODEX_*_POLICY.md` files.
For v1.0.4 claim-to-code, boundary linting, acceptance criteria, risk, evidence
v2, GitHub hysteresis, tool gap, active self-test, hotfix preservation,
PR-chain saturation, role/tool, evidence site, annotation, and Dynamic Workflow
Lite governance, use `docs/process/CODEX_V104_SPEC.md` and the matching
`docs/process/CODEX_*_POLICY.md` or schema files.
For v1.0.5 and v1.0.6 integration reliability, lane separation, provenance,
bounded validation, safe repair mapping, and controlled orchestration, use
`docs/process/CODEX_V105_INTEGRATION_EVIDENCE_RELIABILITY_POLICY.md`,
`docs/process/CODEX_V106_LANE_PROVENANCE_RECOVERY_POLICY.md`, and their schema
files.

## Plan-First Rule

Use plan-first for R3, ambiguous, security-sensitive, migration, release,
dependency, multi-file, or architecture tradeoff work. Keep the plan short and
tie it to affected areas, entrypoints, and failure propagation risk.

## Safe Output Rule

Use safe summary only. Do not print raw logs, raw diffs, raw payloads, secret
values, endpoint values, private paths, production data, or personal data.

## Merge-Ready Claim Rule

Do not claim merge-ready unless required gates, current-head evidence, CI replay
where applicable, and human confirmation rules are satisfied.

## Task Discipline

Before editing, classify work as bugfix, feature, refactor, investigation,
review, release-gate, harness-change, or docs-only. For bugfix work, use the
`codex-bugfix` skill and write reproduction status plus root-cause hypothesis
before code edits unless the change is documentation-only. Keep task-specific
workflow detail in skills or `docs/process`, not in AGENTS.md.
In 5.5 low mode, keep one PR/repo focus, avoid broad changes, and return
exactly one safe next action.

## Agent Doctrine And Skill Routing

Keep AGENTS.md as a compact doctrine and routing map. Load only the skills
needed for the task, normally four or fewer and never more than five. Route
details, review matrices, containment boundaries, state-machine evidence, and
minimal evidence rules live in `docs/process/CODEX_AGENTS_DOCTRINE_POLICY.md`,
`docs/process/CODEX_SKILL_ROUTING_POLICY.md`, and the related v0.9.5 policy
files.

## Manual Confirmation Limit

Manual confirmation cannot override non-overridable failures: secret scan,
blocked paths, high-confidence sensitive findings, stale evidence, unsafe
output, implementation/harness mixing, or weakened quality gates.

## Profile/Core Separation

Root source harness version and profile template version are separate. In
`CODEX_HARNESS_MODE=core`, profiles are optional compatibility artifacts and
must not be required for core quality score.

<!-- CODEX_QUALITY_HARNESS_END -->
