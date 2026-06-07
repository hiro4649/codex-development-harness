<!-- CODEX_QUALITY_HARNESS_FILE v1.1.2 -->

# Conversation Surface Evidence Fidelity Policy

## Policy

The harness must preserve evidence fidelity while reducing conversation volume.
The detailed evidence remains in safe files and artifacts. Conversation output
uses compact summaries and artifact pointers.

## Standard Pattern

```powershell
node scripts/codex-local-quality-gate.mjs > $env:TEMP\gate.json
node scripts/codex-safe-summary-pick.mjs $env:TEMP\gate.json
```

## Output Rules

- Do not paste full quality-gate JSON in chat.
- Do not use tee or Tee-Object for large JSON.
- Use top-N blocker summaries and pass counters.
- Use safe artifact paths and hashes when evidence needs to be referenced.
- Fetch GitHub metadata with budgeted fields by default.

## Fidelity Rule

Compact output must preserve the decisions for hard blocker, allowed action,
forbidden action, one safe next action, merge readiness, product repair
permission, readiness claims, raw log permission, same-head required check
status, and product-code-failure classification.
