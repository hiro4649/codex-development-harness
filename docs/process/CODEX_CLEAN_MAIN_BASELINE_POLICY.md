# Codex Clean-main Baseline Policy

CODEX_QUALITY_HARNESS_FILE v1.0.6

Classify whether a failure belongs to clean main, the current PR, legacy
self-test drift, fixture orchestration, support-file materialization, product
code, remote infrastructure, or an unknown owner before product PR recovery.

Allowed classifications: clean_main_pass, legacy_self_test_drift,
fixture_orchestration_timing, support_file_materialization_mismatch,
source_target_manifest_boundary_error, actual_product_bug,
current_branch_regression, transient_flake, unknown.

Unknown classification blocks recovery. Clean-main failure must not be treated
as a product PR failure without current-head evidence.
