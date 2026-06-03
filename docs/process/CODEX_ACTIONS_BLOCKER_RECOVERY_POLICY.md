<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Actions Blocker Recovery Policy

GitHub Actions failures before job steps must not be confused with product failures. Merge remains blocked until a same-head pull request context run passes.

Failure classes:
- remote_quality_gate_pass
- remote_quality_gate_product_failure
- remote_quality_gate_failed_before_steps
- remote_quality_gate_blocked_account_billing
- remote_quality_gate_infra_failure
- remote_quality_gate_missing_pr_context
- remote_quality_gate_rerun_404
- remote_quality_gate_unknown

Workflow dispatch evidence is not a pull request check substitute.
