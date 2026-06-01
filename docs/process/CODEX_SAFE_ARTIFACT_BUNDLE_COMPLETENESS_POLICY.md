<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Safe Artifact Bundle Completeness Policy

Normal safe bundles must contain enough evidence for a human to classify the blocker without raw logs or raw diffs.

Required when relevant:
- quality gate safe summary
- target final summary
- reason summary
- product verification evidence
- remote baseline evidence
- remote npm diagnostic
- safe artifact index
- lifeboat artifact only on failure paths

Lifeboat-only pass is forbidden.
