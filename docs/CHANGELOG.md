# Changelog

## 2026-06-27

- Added HARNESS v1.3.0 post-merge ambiguity hardening locally.
- Updated Source workflow markers for `quality-gate` and `weekly-health-check` to v1.3.0.
- Pinned core workflow checkout/setup-node actions to full SHAs.
- Added machine-readable target overlay fields showing template-only, non-mutating target install state.
- Re-scoped active policy target install profile under `target_compatibility_profile_install`.
- Added v130 self-test coverage for workflow markers, overlay state, profile scoping, npm applicability, v129 compatibility reference handling, and action pin consistency.
- Local validation passed; remote CI was not run due current GitHub Actions usage restriction.
