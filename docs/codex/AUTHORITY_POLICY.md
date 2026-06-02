<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Authority Policy

## Purpose

HARNESS is a cross-project process repo. It manages Codex workflow, review standards, PR templates, and quality-gate usage across projects. HARNESS does not contain or require `IRIS_SPEC_AUTHORITY.md`.

## Core Rules

- Do not create `IRIS_SPEC_AUTHORITY.md` in HARNESS.
- Do not copy authority files from other clones into HARNESS.
- Do not treat `C:\Users\HIRO-001\Documents\IRIS_SPEC_AUTHORITY.md` as required. It is a deprecated / historical reference only.
- Do not adopt authority files from other clones unless the user explicitly identifies that clone as the active project repo.
- Check project authority only when changing that project's specification, behavior, runtime contract, boundary, or source.
- Common workflow docs may be updated in HARNESS without project-local authority files.

## Project Authorities

### IRIS

The official IRIS source-of-truth is the repo-local `IRIS_SPEC_AUTHORITY.md` inside the active IRIS repo. HARNESS must not duplicate it.

Check it before IRIS specification changes, behavior changes, runtime contract changes, or R3/high-risk source changes. If it is missing inside the active IRIS repo, stop the IRIS body change and record the risk.

### FUNKY

The official FUNKY source-of-truth is the FUNKY repo's own SPEC, BEHAVIOR, or authority docs. Use `docs/funky/SPEC.md` or the existing FUNKY authority docs when present. Use FUNKY questions docs only as a fallback for unresolved items.

### IRIS-live2d-renderer

The official renderer source-of-truth is the renderer repo's own SPEC, REVIEW_POLICY, and quality docs. Keep R3 status. Human review is required for large changes and for Live2D cue schema, renderer boundary, public summary, adapter handoff, and engine response normalization changes.

### HARNESS

For HARNESS policy and workflow changes, use this file and `docs/process/CODEX_PROJECT_AUTHORITY_REGISTRY.json`. If authority questions remain unresolved, record them in `docs/codex/QUESTIONS.md` or the PR risks.

## Env And Policy Changes

`.env.example`, env policy, and quality-gate policy changes require explicit scope. Do not mix them with source, docs, eval, harness, or refactor work.
