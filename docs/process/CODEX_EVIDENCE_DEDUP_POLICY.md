<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Evidence Dedup Policy

- Duplicate evidence blocks must not conflict.
- Head SHA, runtime readiness, and product-code-changed claims must have one current source of truth.
- Repeated status lists should be summarized through safe artifacts.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
