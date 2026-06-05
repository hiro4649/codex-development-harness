<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Workflow Preflight Policy

Workflow preflight keeps GitHub Actions setup small and diagnosable.

Rules:
- Detect source or target mode before running the local gate.
- Check required harness files and Node major version.
- Detect package manager files without printing environment values.
- Decide whether product npm checks should be attempted from safe change classification.
- Write `codex-workflow-preflight.safe.json`.
- Output safe summary only.
