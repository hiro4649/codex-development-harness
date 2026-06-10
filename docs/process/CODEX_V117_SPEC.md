# Codex Harness v1.1.7 Spec

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.7 -->

## Theme

Outcome-Verified Decision Capsule and Artifact-Consistent Minimal Surface.

v1.1.7 keeps v1.1.6 safety boundaries and tightens the places where rollout
work previously became ambiguous: outcome proof, verifier independence,
artifact consistency, compact final output, and safe failure reading.

## P0 Scope

v1.1.7 has exactly six P0 items:

1. Decision Capsule Authority Preservation
2. Outcome Contract
3. Verifier Capsule
4. Artifact Consistency Contract
5. Delta-Only Finalizer
6. Safe Failure Reader

These are operator-visible and machine-checked. The operator-visible status
surface limit is 12; v1.1.7 uses 6 P0 statuses.

## P1a Minimal Scope

The following are minimal or fixture-only unless a future owner scope requires
more:

- Scope Grant Matrix
- Legacy Compatibility Compression
- Validation Fast Path

## P1b Spec And Fixture Scope

The following are specification and fixture-only:

- Boundary Registry Compression
- Failure Contract v2
- Owner Confirmation Ingestion
- Harness/Product/Test Classification

## P2 Spec And Fixture Scope

The following are specification and fixture-only:

- Verified Memory Rules
- Consulted Memory Audit
- Memory Invalidation
- Repair Experiment Ledger
- External Verifier Model

## Non-Goals

- No target rollout.
- No product code change.
- No package or lockfile change.
- No broad workflow change.
- No runtime readiness claim.
- No production readiness claim.
- No raw log access.
- No 8-session operation.
- No wallet, RPC, deploy, governance, funded transaction, or release access.

## Acceptance

Source v1.1.7 is acceptable only when:

- v113, v114, v115, v116, and v117 self-tests pass.
- Source local quality gate passes with `qualityScore` 100.
- Decision Capsule remains the first authoritative decision source.
- Outcome Contract has concrete exit criteria and requires verifier evidence.
- Verifier Capsule is read-only, independent, and raw-log-free.
- Artifact Consistency proves load-bearing artifacts are generated, indexed,
  uploaded, and observed on the same head.
- The load-bearing artifact set is:
  `codex-decision-capsule.safe.json`,
  `codex-artifact-consistency.safe.json`,
  `codex-minimal-blockers.safe.json`, and
  `codex-quality-gate-safe-summary.json`.
- The source quality gate must emit these artifacts as real safe files and the
  workflow upload contract must include them. If the safe index says a
  load-bearing artifact is present but the artifact is missing, the primary
  class is `artifact_index_consistency_failure`. If an artifact exists for a
  stale head, the primary class is `artifact_stale_head`.
- `safe_detail_unavailable` is the final fallback only after the load-bearing
  artifact consistency path cannot provide safe detail.
- Delta-only final output excludes unchanged history.
- Safe Failure Reader uses safe artifacts only.
