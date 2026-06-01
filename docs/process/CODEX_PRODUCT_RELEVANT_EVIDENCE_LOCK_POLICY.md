<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Product-Relevant Evidence Lock Policy

Version: v0.9.4

Blocks product-relevant PR success until product verification, remote product baseline, npm baseline when required, same-head evidence, skip-npm decision, and runtime readiness denial or oracle evidence are all represented.

## Safety Constraints

- Product code is not changed by this policy.
- Product commands are not executed automatically.
- External LLM judges, MCP, browsers, Playwright, AST parsers, and npm dependencies are not required.
- Raw logs, raw diffs, secrets, endpoints, private absolute paths, production data, and personal data are not emitted.
- Fixture pass is not runtime readiness.
- workflow_dispatch pass is not a PR check substitute.

## Safe Failure Shape

Failures produce reason codes, compact safe summaries, and a next safe action. Body-only repair is allowed only when it does not hide product evidence, same-head, runtime, tx, chain, or security failures.
