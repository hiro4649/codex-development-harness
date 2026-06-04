<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Local Gate Report Contract Policy

When `CODEX_QUALITY_REPORT=json` is set, the local gate returns parseable safe JSON on stdout or declares an explicit report path in safe JSON.

Timeout, empty output, mixed human text, parse failure, missing report path, and unknown contract are failures, never pass.
