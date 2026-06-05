<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Workflow Stop Condition Policy

Stops on forbidden files, readiness claims, same-head mismatch, remote failure, missing artifacts, and unresolved Actions blockers.

## Required Boundary

- Product code changed: no for harness-only work.
- Runtime readiness claimed: no unless an external runtime oracle is present.
- Production readiness claimed: no unless owner approval and production evidence are present.
- Raw logs, raw diffs, tokens, endpoint values, private paths, payloads, commands, candidates, and world commands stay out of artifacts.

## Evidence Confidence

Every output separates confirmed, inferred, unknown, conflict, and deprecated_candidate claims. Inferred or unknown findings cannot become deletion, migration, cost, performance, runtime, or production claims.
