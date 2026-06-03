<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Formal Evidence Precedence Policy

Formal same-head remote product evidence has precedence over pending placeholder diagnostics and standby lifeboat artifacts. A normal safe bundle plus standby lifeboat is diagnostic, not a failure.

Blocking conditions:
- formal product evidence is missing or failed
- remote baseline, target summary, reason summary, or npm diagnostic is missing when relevant
- npm failure is present
- placeholder-only evidence is used as pass
- lifeboat-only evidence is treated as pass
- same-head evidence does not match

This policy does not permit production or runtime readiness claims.
