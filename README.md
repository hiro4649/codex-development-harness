<!-- CODEX_QUALITY_HARNESS_FILE v0.7.0 -->

# Codex Development Harness

This repository is the canonical source for the Codex quality harness.

Current local baseline:

- Version: v0.7.0
- Update name: OpenAI Codex Method Gate
- Profiles:
  - `profiles/iris`
  - `profiles/funky`
  - `profiles/iris-live2d-renderer`

This repository is prepared as the source for v0.7.0. Propagating the matching
profile files into real development projects is a separate task and is not run
by this repository update.

Not updated by this change:

- `C:\Users\HIRO-001\Documents\CodexProjects\IRIS`
- `C:\Users\HIRO-001\Documents\CodexProjects\FUNKY`
- `C:\Users\HIRO-001\Documents\CodexProjects\IRIS-live2d-renderer`

Do not use old directories under `C:\Users\HIRO-001\Documents\Codex` or local
snapshot-only directories as the harness source of truth.


## v0.7.0 OpenAI Codex Method Gate

v0.7.0 makes OpenAI Codex best practices CI-enforced at the pull request level. It checks PR body evidence for Goal, Context, Constraints, Done when, Plan-first status, Environment setup, Testing and review, and Residual risks before a PR can be treated as merge-ready.

This source update manages docs/process/code_review.md and the PR template as first-class harness files. Propagation to FUNKY, IRIS, and IRIS-live2d-renderer is a separate follow-up task and is not performed by this source PR.
