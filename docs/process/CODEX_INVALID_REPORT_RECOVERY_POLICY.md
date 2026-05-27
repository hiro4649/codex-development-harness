<!-- CODEX_QUALITY_HARNESS_FILE v0.9.3 -->
# Invalid Report Recovery Policy

When a local quality report is missing or malformed, the workflow runner must not print or store the raw report. It writes safe fallback artifacts with safe reason codes and path labels only.
