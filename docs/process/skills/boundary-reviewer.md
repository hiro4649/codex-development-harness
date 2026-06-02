<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Skill: Boundary Reviewer

## Role

Review whether the change preserves project boundaries, contracts, and ownership.

## Review Focus

- Core / adapter boundaries.
- Runtime contracts and I/O shape.
- Public API or schema changes.
- Handoff points between systems.
- Project-specific R3 boundary rules.

## Required Checks

- Confirm validation stays at the correct boundary.
- Confirm project responsibilities are not moved without explicit scope.
- Confirm external contract changes have tests and review.
- For IRIS-live2d-renderer, check Live2D cue schema, renderer boundary, public summary, adapter handoff, and engine response normalization.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- Contract change without spec or tests.
- Boundary moved across Core / Adapter or renderer handoff without explicit review.
- R3 boundary change without human review.

## Human Review Conditions

- R3 boundary changes.
- Public schema or runtime contract changes.
- Renderer boundary and handoff changes.
