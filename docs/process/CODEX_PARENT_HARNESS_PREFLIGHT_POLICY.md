<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Parent Harness Preflight Policy

New harness development uses the stable parent harness as the preflight authority. v1.0.1 uses v1.0.0 as parent.

When the parent defect is exactly the local gate JSON report contract, a degraded preflight lane is allowed only with clean source HEAD, v100 self-test pass, secret scan pass, and same-head remote quality-gate success.
