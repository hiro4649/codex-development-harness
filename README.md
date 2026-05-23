<!-- CODEX_QUALITY_HARNESS_FILE v0.7.2 -->

# Codex Development Harness

This repository is the canonical source for the Codex quality harness.

Current local baseline:

- Version: v0.7.2
- Update name: Structured Evidence and CI Replay Gate
- Root harness version: `0.7.2`
- Profile template version: `0.7.0` compatible
- Profiles:
  - `profiles/iris`
  - `profiles/funky`
  - `profiles/iris-live2d-renderer`

This source update is limited to the harness repository. It does not update,
edit, test, or initialize these real development projects:

- `IRIS`
- `FUNKY`
- `IRIS-live2d-renderer`

Do not use old directories or snapshot-only directories as the harness source of
truth. Do not bump profile templates to v0.7.2 just to satisfy root harness
validation; the source harness and profile template version domains are separate.

## v0.7.2 Structured Evidence and CI Replay Gate

v0.7.2 keeps the v0.7.1 production, evidence, Hermes, human confirmation, and
quality-score rules, then reduces PR prose dependence and CI/local mismatch by
adding structured evidence, structured human confirmation, safer output scanning,
CI replay, PR body linting, and a safe failure reason catalog.

New or expanded source-harness gates:

- Structured Evidence Pack Gate
- Structured Human Confirmation Gate
- Safe Output Scanner
- CI Replay Gate
- PR Body Linter
- Failure Reason Catalog Status
- v0.7.2 Self-Test Gate
- Production Readiness Gate
- Evidence Integrity Gate
- Hermes Invariant Gate
- v0.7.1 Self-Test Gate
- Quality Score Summary
- Profile Template Compatibility Status

The gates preserve v0.7.1 behavior: secret scan, unsafe wording detection,
test-weakening detection, OpenAI Codex Method Gate, safe artifact validation,
scope separation, R3 handling, production evidence enforcement, Hermes
invariants, and non-overridable failure rules remain active.

Reports are safe summaries only. They must not print secrets, endpoint values,
private paths, raw logs, raw payloads, production data, or personal data.
