<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Codex Safe Artifact Classifier Policy

Safe artifacts describe failures with safe labels and next actions. The classifier must distinguish body-only repair, code repair, stale evidence, missing R3 confirmation, runner or queue issues, auth or account limitations, workflow-dispatch-only evidence, product verification needs, and unproven runtime readiness.

Failure artifacts must include a safe next action. Product-relevant failures cannot be downgraded to body-only repair, and runtime readiness cannot be inferred from fixture or harness rollout success.
