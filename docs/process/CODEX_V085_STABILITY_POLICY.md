<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# CODEX_V085_STABILITY_POLICY

v0.8.5 adds lightweight execution stability checks without running product
tests, touching the network, or weakening v0.8.4 gates.

The gate reads only PR text, existing safe reports, classification, and optional
target-local config. It summarizes task mode, bugfix evidence, PR profile repair
hints, product verification explanations, optional import smoke configuration,
runtime risk register state, checkout evidence priority, fast-path
interpretation, and a one-screen dashboard.

Product changes must not pass through fast path. Runtime readiness is never
inferred from harness checks.
