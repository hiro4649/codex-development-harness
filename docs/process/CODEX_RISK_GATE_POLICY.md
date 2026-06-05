# Risk Gate Policy

CODEX_QUALITY_HARNESS_FILE v1.0.7

Statuses:

- riskGateStatus
- unresolvedHighRiskStatus
- riskAcceptedByOwnerStatus
- riskCannotBeOverriddenStatus
- riskBudgetStatus

Non-overridable failures include secret leak, private key exposure, seed phrase
exposure, missing same-head remote evidence for merge, runtime readiness claimed
without evidence, production readiness claimed without evidence, unsafe custody,
candidate execution shortcut, raw wallet identity leak, raw transaction hash tied
to viewer identity, Git mutation by local gate, and target hotfix dropped during
rollout.
