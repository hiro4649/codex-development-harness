# External Blocked Terminal Policy

CODEX_QUALITY_HARNESS_FILE v1.0.7

Statuses:

- externalBlockedTerminalStatus
- codexActionAllowedStatus
- newPrAllowedStatus
- preserveOnlyStatus
- userManualWorkAvoidedStatus

Terminal blockers include independent reviewer unavailable, owner decision
required, GitHub permission unavailable, billing or Actions external block, repo
identity unconfirmed, legal review required, YouTube policy review required, and
crypto compliance review required.

Terminal blocked is not product fail and not merge pass. It prevents low-value
new harness PRs and produces one safe next action.
