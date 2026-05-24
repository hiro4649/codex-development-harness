# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v0.8.2

## Source Harness Boundary

This repository is the Codex Development Harness source. Work here must stay in
the harness itself unless a task explicitly names a downstream project. Do not
change downstream project repositories from source harness work.
Use `docs/process/CODEX_OPENAI_CODEX_METHOD_POLICY.md` and
`docs/process/code_review.md` as the stable method references.

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

## Manual Confirmation Limit

Manual confirmation cannot override non-overridable failures: secret scan,
blocked paths, high-confidence sensitive findings, stale evidence, unsafe
output, implementation/harness mixing, or weakened quality gates.

## Profile/Core Separation

Root source harness version and profile template version are separate. In
`CODEX_HARNESS_MODE=core`, profiles are optional compatibility artifacts and
must not be required for core quality score.

<!-- CODEX_QUALITY_HARNESS_END -->
