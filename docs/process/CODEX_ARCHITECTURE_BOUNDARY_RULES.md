# Architecture Boundary Rules

CODEX_QUALITY_HARNESS_FILE v1.0.4

Statuses:

- architectureBoundaryLinterStatus
- forbiddenReferenceStatus
- repositoryBoundaryStatus
- uiSecretBoundaryStatus
- runtimeReadyEscalationBoundaryStatus
- candidateExecutionBoundaryStatus
- walletPrivacyBoundaryStatus
- youtubeCryptoBoundaryStatus

Rules are deterministic and raw-output-free. Forbidden examples include
repository.recentTipsByWallet, repository.affinityByUser, repository.supportEvents,
repository.tipIntents, repository.outboxEvents, repository.deadLetterEvents,
repository.auditLogs, PRIVATE_KEY, MNEMONIC, SECRET, RPC_URL, DATABASE_URL,
dangerouslySetInnerHTML, innerHTML, wallet_address reaction or memory use, tx_hash
viewer identity use, profit, yield, price prediction, and Super Chat bypass.
