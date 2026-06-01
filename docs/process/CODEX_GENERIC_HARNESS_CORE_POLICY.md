# Generic Harness Core Policy

<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->

The source harness core must run as a generic Codex development and audit
harness. In `CODEX_HARNESS_MODE=core`, profile checks are optional
compatibility artifacts and must not be required for merge readiness,
quality score, or source harness validation.

Core scripts, workflows, process policies, and manifest gate logic must not
make downstream project names a required dependency. Historical or explanatory
mentions are acceptable outside required gate logic, and profile arrays in the
source manifest may remain as optional compatibility metadata.

Core mode fails when:

- profile governance is required in `CODEX_HARNESS_MODE=core`
- source quality score requires profile checks
- scripts or workflows require a downstream project profile to pass
- source manifest removes the profile/core version separation

Core mode passes when profile compatibility is `off` or `optional`, source
harness files validate independently, and downstream profiles are treated only
as compatibility fixtures.
