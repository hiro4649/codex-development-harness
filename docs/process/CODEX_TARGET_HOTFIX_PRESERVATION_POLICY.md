<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Codex Target Hotfix Preservation Policy

Version: v0.9.3

Target rollout must not silently discard existing target hotfixes, target-specific adaptations, or pre-existing uncommitted harness-managed changes. The rollout may update source-owned harness files only after preserving or migrating target deltas with safe summary evidence.

## Required Behavior

- Preserve target hotfixes unless a migration record explains their replacement.
- Preserve target-specific adaptations such as script classifications and target-only policy files.
- Keep pre-existing uncommitted changes out of the rollout PR by recording a stash or patch before applying source harness updates.
- Record target patch decisions in `docs/process/CODEX_TARGET_PATCH_MANIFEST.json` when a target keeps a local adaptation.
- Do not print raw diffs; report file labels, classifications, and safe reason codes only.

## Blocking Conditions

A rollout blocks when a target hotfix is overwritten, a target-specific adaptation disappears, a target-only policy is deleted without migration evidence, or an unknown target harness delta is replaced without review.
