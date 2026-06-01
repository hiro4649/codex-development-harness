<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Safe Artifact Index Policy

Every workflow safe artifact should be listed in one compact index.

Rules:
- The index lists artifact name, path, producer, status, mode, next action, and reason codes.
- Raw logs, raw diffs, raw payloads, endpoint values, private paths, production data, personal data, tokens, and secrets are forbidden.
- Missing expected artifacts are recorded with safe reason codes.
- Primary human artifacts are limited to three files by default: consolidated diagnostics, quality summary, and failure reasons.
- Artifact budget overflow is a warning unless an unsafe or required artifact is missing.
- The index itself is safe summary only.
