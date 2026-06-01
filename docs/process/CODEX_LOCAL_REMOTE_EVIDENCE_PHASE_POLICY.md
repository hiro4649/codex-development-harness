<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Local Remote Evidence Phase Policy

Separates local pre-push implementation validation from post-push remote evidence. Workflow dispatch evidence is diagnostic and is not a PR check substitute.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
