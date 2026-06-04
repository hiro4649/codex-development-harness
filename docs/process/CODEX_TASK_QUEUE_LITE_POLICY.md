<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Task Queue Lite Policy

Task queue evidence is optional. If present at `.codex/task-queue.json`, it must
be safe summary only and may include taskId, title, status, riskLevel,
safeSummary, nextAction, and blockedReason. It is not required for merge
readiness unless the PR claims queue evidence.
