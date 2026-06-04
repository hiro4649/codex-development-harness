<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Remote NPM Diagnostic Policy

Remote npm diagnostics classify failures without exposing logs.

Rules:
- Use safe metadata and safe markers only.
- Do not parse, upload, print, or store raw npm logs, stack traces, raw stdout, raw stderr, raw payloads, endpoint values, private paths, production data, personal data, tokens, or secrets.
- Unknown failures are allowed as a safe category, but they must be flagged for follow-up.
- Diagnostics explain failure class; they do not make product runtime readiness claims.
