<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Refactoring Policy

Refactoring is not a cleanup reward. It is a risk-managed investment.

## Allowed

- Small refactors directly needed by the current task.
- One responsibility per PR.
- Characterization tests before behavior-preserving changes when behavior is not obvious.

## Not allowed by default

- Broad rename or file movement.
- Dependency changes mixed into feature PRs.
- Parallel large refactors across multiple modules.
- Behavior change hidden inside refactoring.

## Weekly codebase improvement

Use multiple AI agents for diagnosis, not parallel code changes. Merge only small, ordered, reviewed PRs.
