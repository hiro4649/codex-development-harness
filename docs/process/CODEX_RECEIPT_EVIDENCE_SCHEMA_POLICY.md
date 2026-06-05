<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Receipt Evidence Schema Policy

- Receipt evidence must be safe public data only.
- Allowed fields include txHash, chainId, from, to, contractAddress, blockNumber, status, timestamp, publicAmount, and receiptSource.
- Private keys, raw RPC URLs, raw payloads, and raw logs are forbidden.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
