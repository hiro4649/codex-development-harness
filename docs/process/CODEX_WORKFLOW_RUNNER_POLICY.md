<!-- CODEX_QUALITY_HARNESS_FILE v0.8.3 -->
# Codex Workflow Runner Policy

The workflow runner evaluates the JSON report from `scripts/codex-local-quality-gate.mjs` and writes safe artifacts only. It must preserve source and target gate requirements, manual confirmation behavior, and non-overridable failures.

It must not print or upload raw PR bodies, comments, logs, payloads, diffs, endpoint values, private paths, production data, personal data, tokens, or secrets.

