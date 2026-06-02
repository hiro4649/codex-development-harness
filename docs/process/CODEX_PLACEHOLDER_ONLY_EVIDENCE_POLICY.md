<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Placeholder-Only Evidence Policy

Product-relevant pull requests must not pass with placeholder-only product evidence. Pending placeholder artifacts are allowed only before formal remote evidence exists and cannot satisfy merge readiness.

Pass conditions:
- formal same-head evidence supersedes a placeholder
- harness-only changes mark product evidence as not applicable

Fail conditions:
- product-relevant PR has only placeholder evidence
- placeholder baseline or diagnostic is final pass evidence
- manual confirmation overrides placeholder-only failure
