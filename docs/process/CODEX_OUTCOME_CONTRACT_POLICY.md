<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Outcome Contract Policy

Before a product behavior change, Codex records the outcome contract: `replacedBehavior`, `expectedOutcome`, `sourceOfTruthOwner`, `oldPathDisposition`, and `doneEvidence`.

The contract fails when the replaced behavior, user outcome, owner, old path disposition, or done evidence is missing. Test pass alone is not done evidence for a behavior change. Local evidence must not be presented as runtime readiness or production readiness.
