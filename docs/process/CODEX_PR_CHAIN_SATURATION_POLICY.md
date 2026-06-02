# PR Chain Saturation Policy

CODEX_QUALITY_HARNESS_FILE v1.0.4

Statuses:

- prChainExpansionStatus
- harnessWorkSaturationStatus
- nextPrNecessityStatus
- duplicatePrCandidateStatus
- classificationSufficientStatus
- implementationNeededStatus
- stopMakingHarnessPrStatus
- preserveInsteadOfCreateStatus
- noNewPrUntilExternalBlockedResolvedStatus
- productWorkReturnReadinessStatus

If a PR chain is saturated or duplicates a frozen chain, preserve instead of
creating new harness PRs. Classification sufficiency stops classifier PR churn.
