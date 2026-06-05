<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Prisma State Machine Schema Policy

- Tx and job models need explicit state fields before runtime readiness can be claimed.
- A processed boolean alone is not sufficient double-send protection.
- Schema changes need migration, backfill, and rollback evidence when product relevant.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
