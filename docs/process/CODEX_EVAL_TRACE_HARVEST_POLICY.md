<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Eval Trace Harvest Policy

- Operator and review corrections can become eval candidates only with observed and expected behavior.
- Raw production data and personal data are forbidden.
- Eval candidates require safe scope and a do-not-touch list.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
