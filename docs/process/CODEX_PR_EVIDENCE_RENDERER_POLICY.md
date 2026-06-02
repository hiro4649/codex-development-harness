<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Codex PR Evidence Renderer Policy

PR evidence must be generated as safe summary blocks for the current head. The renderer may emit Remote/Local Evidence, Evidence Integrity, Human Confirmation, Evidence Pack, Manual Confirmation, Residual Risks, Rollback, and Stale Evidence Check sections.

It must not emit raw logs, raw diffs, token-like values, endpoint values, private paths, production data, personal data, or payload dumps. Product code and runtime readiness claims must match changed-file evidence.
