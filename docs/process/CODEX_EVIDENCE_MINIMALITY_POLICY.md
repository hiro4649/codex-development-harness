<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Evidence Minimality Policy

- PR bodies keep only the smallest required evidence.
- Raw logs, raw diffs, and long generated lists are forbidden.
- When safe artifacts exist, PR bodies should reference them instead of duplicating details.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
