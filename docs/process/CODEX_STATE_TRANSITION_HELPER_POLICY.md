<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# State Transition Helper Policy

- State fields require pure transition helpers and focused transition tests.
- Helpers must not mutate the database directly.
- Invalid transitions, claim, timeout, retry, and safe error paths must be covered when relevant.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
