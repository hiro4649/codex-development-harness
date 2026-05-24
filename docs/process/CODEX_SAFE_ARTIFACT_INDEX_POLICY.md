<!-- CODEX_QUALITY_HARNESS_FILE v0.8.3 -->
# Safe Artifact Index Policy

Every workflow safe artifact should be listed in one compact index.

Rules:
- The index lists artifact name, path, producer, status, mode, next action, and reason codes.
- Raw logs, raw diffs, raw payloads, endpoint values, private paths, production data, personal data, tokens, and secrets are forbidden.
- Missing expected artifacts are recorded with safe reason codes.
- The index itself is safe summary only.
