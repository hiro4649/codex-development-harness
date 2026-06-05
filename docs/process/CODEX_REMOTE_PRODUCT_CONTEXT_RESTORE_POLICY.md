<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Remote Product Context Restore Policy

Version: v0.9.4

Keeps pull_request product context, changed-file classification, npm and remote baseline requirements, and same-head evidence fields intact from workflow preflight through runner, diagnostics, safe artifacts, final summary, and PR evidence.

## Safety Constraints

- Product code is not changed by this policy.
- Product commands are not executed automatically.
- External LLM judges, MCP, browsers, Playwright, AST parsers, and npm dependencies are not required.
- Raw logs, raw diffs, secrets, endpoints, private absolute paths, production data, and personal data are not emitted.
- Fixture pass is not runtime readiness.
- workflow_dispatch pass is not a PR check substitute.

## Safe Failure Shape

Failures produce reason codes, compact safe summaries, and a next safe action. Body-only repair is allowed only when it does not hide product evidence, same-head, runtime, tx, chain, or security failures.
