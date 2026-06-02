<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Questions

Use this file only for unresolved HARNESS authority or workflow questions that cannot be answered from `docs/codex/AUTHORITY_POLICY.md` and `docs/process/CODEX_PROJECT_AUTHORITY_REGISTRY.json`.

## Future Improvements

- `CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs` currently passes in HARNESS, but the HARNESS quality-gate script still emits text output. Do not treat this as a blocker for HARNESS workflow docs. Revisit JSON report support in a dedicated quality-gate improvement PR.
- Repos that require a real JSON quality report must confirm it in that project repo's own quality gate.
