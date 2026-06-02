<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Reason Summary Final Aggregation Policy

Final aggregation must not report top-level failure when target quality, active self-test, and current blocking reasons are all pass. Legacy advisory failures and stale blockers cannot become current blockers, while product verification, safe output, target quality, runtime readiness, and production go failures remain non-overridable.
