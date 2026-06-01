<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Codex Complexity Governance Policy

v0.8.8 adds lightweight complexity-aware verification governance.

Principles:

- Reasoning effort is not evidence.
- Complexity decides governance.
- High-complexity work requires an oracle.
- If a task cannot be verified, it is not ready.
- If a task is underspecified or contradictory, stop before implementation.
- Prefer algorithmic artifacts over long explanations.
- Do not confuse missing tools with reasoning failure.
- Keep the gate light, deterministic, and source-safe.

The gate classifies work as low, medium, high, or unknown using PR body fields,
changed file paths, existing gate statuses, and safe structured inputs. It does
not inspect hidden chain-of-thought, call external services, require MCP,
require Playwright, run product commands, or add npm dependencies.

High-complexity work must provide a task contract, oracle, verification surface,
risk surface, split plan or split reason, current-head evidence, human
confirmation, and rollback or stop condition. Missing or weak evidence remains
blocking according to existing non-overridable safety gates.
