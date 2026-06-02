<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Tx Path State Evidence Policy

Version: v0.9.4

Requires state evidence for tx submission, txHash persistence, chainId, receipt status, DB update after receipt, idempotency, retry, timeout, and partial failure handling on chain or payment paths.

## Safety Constraints

- Product code is not changed by this policy.
- Product commands are not executed automatically.
- External LLM judges, MCP, browsers, Playwright, AST parsers, and npm dependencies are not required.
- Raw logs, raw diffs, secrets, endpoints, private absolute paths, production data, and personal data are not emitted.
- Fixture pass is not runtime readiness.
- workflow_dispatch pass is not a PR check substitute.

## Safe Failure Shape

Failures produce reason codes, compact safe summaries, and a next safe action. Body-only repair is allowed only when it does not hide product evidence, same-head, runtime, tx, chain, or security failures.
