<!-- CODEX_QUALITY_HARNESS_FILE v0.7.1 -->

# Codex Development Harness

This repository is the canonical source for the Codex quality harness.

Current local baseline:

- Version: v0.7.1
- Update name: Production Evidence and Hermes Gate
- Root harness version: `0.7.1`
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
truth. Do not bump profile templates to v0.7.1 just to satisfy root harness
validation; the source harness and profile template version domains are separate.

## v0.7.1 Production Evidence and Hermes Gate

v0.7.1 tightens the conditions for production, release, merge-ready, go/no-go,
and similar claims. It does not create production readiness by itself. It
requires safe, checkable evidence before those claims can pass.

New source-harness gates:

- Production Readiness Gate
- Evidence Integrity Gate
- Hermes Invariant Gate
- v0.7.1 Self-Test Gate
- Quality Score Summary
- Profile Template Compatibility Status

The gates preserve v0.7.0 behavior: secret scan, unsafe wording detection,
test-weakening detection, OpenAI Codex Method Gate, safe artifact validation,
scope separation, R3 handling, and non-overridable failure rules remain active.

Reports are safe summaries only. They must not print secrets, endpoint values,
private paths, raw logs, raw payloads, production data, or personal data.
