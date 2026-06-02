<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Target Local Path Discovery Policy

Target work must discover the current local path and verify remote identity before analysis. Past paths are never source of truth.

Ambiguous target path discovery fails until one canonical worktree is selected by remote URL and main HEAD.
