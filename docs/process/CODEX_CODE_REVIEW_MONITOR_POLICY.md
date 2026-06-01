<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Code Review Monitor Policy

The Code Review Monitor is a lightweight path, evidence, and existing-status
gate for Codex-authored changes. It does not parse raw diffs, run product
commands, call external services, require an LLM judge, or store raw logs.

It checks whether changed surfaces have enough safe review evidence:
correctness, regression, security, data integrity, runtime safety, test
evidence, and diff scope. P0 findings fail, P1 findings require manual
confirmation, and P2 findings warn.

Harness-only and docs-only work can pass when it stays within declared managed
files and does not claim runtime, release, security, performance, package, or
product readiness. Product verification failures remain blocking and are not
converted to pass by this monitor.
