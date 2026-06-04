<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Remote Product Baseline Policy

Product-relevant PRs need safe evidence for the base branch before candidate results are interpreted.

Rules:
- Harness-only and docs-only PRs do not require product baseline evidence unless they claim runtime readiness.
- Product source, tests, specs, package files, lockfiles, runtime assets, runtime readiness claims, or performance claims require a safe baseline object.
- The gate validates baseline evidence only. It does not run npm, tests, builds, or runtime checks.
- Failing or stale baseline evidence keeps merge readiness blocked for product-relevant work.
- Output is safe summary only. Do not store raw logs, raw payloads, raw diffs, endpoint values, private paths, production data, personal data, tokens, or secrets.
