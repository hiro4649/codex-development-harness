<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Codex Evidence Integrity Policy

Evidence must be checkable, current, and scoped to the head being reviewed. Text that merely says "passed", "looks good", "verified", "done", "TBD", or "not run" is weak evidence unless paired with command, result, source, date, and a reason where applicable.

## Required Evidence Fields

- command
- result
- exit code or pass/fail
- date or timestamp
- source: local, CI, GitHub Actions, or manual
- head SHA when PR readiness is claimed
- skipped checks and reason
- residual risks
- remote quality-gate evidence
- quality report path or evidence pack path when available

## Fail Conditions

- weak evidence is treated as pass
- stale evidence is treated as current
- skipped check has no reason
- production, release, security, or R3 evidence lacks head SHA
- GitHub Actions PASS is written but not verifiable by source labels
- unsafe artifact shape appears in the report

## Manual Confirmation Limits

Manual confirmation may classify missing remote access, but it cannot override unsafe output, stale evidence, secret exposure, blocked paths, or failed required checks.
