<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Preview And Smoke Check Standard

## Purpose

Use these checks as the Vercel-preview equivalent for each project. Run them after implementation review feedback has been applied and before PR merge.

## IRIS

- `npm test`
- `node scripts/verify-iris.mjs`
- Git for Windows bash: `scripts/verify-iris.sh`
- Secret scan
- Local quality gate
- Profile required checks
- JSON quality report
- Runtime smoke

## FUNKY

- `scripts/verify-funky.sh`
- Backend build/test
- Frontend build
- Contracts compile/test
- NFT compile/test
- Secret scan
- Local quality gate
- Profile required checks
- JSON quality report

## IRIS-live2d-renderer

- `scripts/verify-iris-live2d-renderer.sh`
- `npm test`
- Renderer smoke
- Docs lint
- Boundary/eval
- Secret scan
- Local quality gate
- Profile required checks
- JSON quality report

## HARNESS

- Secret scan
- Local quality gate
- Profile required checks
- JSON quality report when supported by the current quality gate
- `git diff --check`
- `git diff --cached --check` when staged content exists

## Evidence

Record command, result, date, and any skipped checks. Do not mark unavailable project-repo checks as pass from HARNESS.
