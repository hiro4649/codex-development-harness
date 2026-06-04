<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Codex Target Rollout Conflict Policy

Version: v0.9.3

Before source harness files are copied into a target repository, the rollout must check for target-only files, preserved hotfixes, stash or patch references, and manifest entries that would be lost.

## Safe Conflict Surface

The gate reports only safe summaries: changed path labels, conflict classes, and next actions. It never emits raw diffs, private local paths, secrets, or endpoint values.

## Required Result

A harness-only rollout may continue only when target-specific patches are preserved, migrated with evidence, or explicitly marked manual-required. Product files remain out of scope.
