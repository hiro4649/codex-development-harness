<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Target Final Summary Policy

Final summaries must fit on one screen and stay safe.

Rules:
- Source workflows write `codex-source-final-summary.json`.
- Target workflows write `codex-target-final-summary.json`.
- Include score, context, classification, product verification, baseline, npm diagnostic, stale PR audit, reason summary, merge readiness, and next action.
- Do not include raw logs, raw payloads, raw diffs, endpoint values, private paths, production data, personal data, tokens, or secrets.
