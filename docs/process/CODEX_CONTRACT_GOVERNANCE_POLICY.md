<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Contract Governance Policy

Task completion is a contract. Risky harness, product, release, runtime,
security, auth, storage, API, and long-running work must expose done criteria,
verification surface, risk surface, allowed scope, forbidden scope, handoff
conditions, stop conditions, and load-bearing evidence when new gates or
policies are introduced.

The gate is structural and lightweight. It reads PR body and optional safe JSON
fixtures only. It does not run product tests, does not inspect raw diffs, and
does not store raw logs or payloads.

Docs-only, typo-only, marker-only, and small safe wording updates do not require
a task contract.
