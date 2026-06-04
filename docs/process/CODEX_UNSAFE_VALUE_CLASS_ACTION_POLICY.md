<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Unsafe Value Class Action Policy

Unsafe value handling is field-scoped. Reason codes and safe labels are checked as constrained labels. Actual values and raw output fields are checked strictly.

Public GitHub URLs are allowed only in source or PR reference fields. Documentation URLs are allowed only in documentation or source fields. Endpoint values, secrets, private paths, raw logs, raw payloads, production data, and personal data must be redacted or fail.
