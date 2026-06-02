<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Environment Readiness Policy

The source harness must explain how to run its local gates without assuming
hidden setup. Node.js 20 or newer is the expected runtime for harness scripts.
No npm dependency is required by the harness core. If `package.json` is absent,
npm checks are not proof and are reported as not applicable.

The gate checks that startup/setup guidance exists, does not require internet
access, and never prints environment variable values.
