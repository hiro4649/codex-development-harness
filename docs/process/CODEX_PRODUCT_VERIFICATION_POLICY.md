<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Product Verification Policy

`CODEX_SKIP_NPM=1` is allowed for harness-only changes with no runtime readiness claim. It is not a substitute for product verification.

Rules:
- Harness-only changes may skip npm checks with safe reason.
- Docs-only changes may skip npm checks with explicit reason.
- Product source, tests, specs, authority, package, lockfile, runtime assets, or config changes require project verification evidence.
- Runtime readiness claims require actual verification commands.
- Package or lockfile changes require package verification evidence.
- Emergency manual review can classify unresolved evidence, but merge readiness remains false.

Do not invent npm install commands. Use repository conventions only.
