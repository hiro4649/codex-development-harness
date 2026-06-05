<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Codex Harness v1.0.5 Integration Evidence Reliability Policy

## Scope

v1.0.5 is a Source HARNESS release only. It does not roll out to target
repositories, does not run representative real target PR validation, and does
not implement product runtime behavior.

The release adds deterministic synthetic fixture gates for integration evidence
reliability:

- representative product PR validation
- evidence single source of truth
- target safe report contract
- source-only compatibility
- active and legacy self-test summary
- diagnostic source tracing
- quality-gate self-protection
- integration governance
- production readiness G4 gate
- observability, chaos-lite, and atomicity evidence
- typed review evidence
- owner-values validator standard
- token deployment ladder state
- safe suggested patch
- 5.5-low task size advisor
- dynamic workflow worker boundary v2

## Required Statuses

The active v1.0.5 source gate must export:

- `v105SelfTestStatus`
- `representativeProductPrValidationStatus`
- `evidenceSingleSourceStatus`
- `evidenceDriftCheckerStatus`
- `targetSafeReportContractStatus`
- `sourceOnlyCompatibilityStatus`
- `activeLegacySelfTestSummaryStatus`
- `diagnosticSourceTraceStatus`
- `qualityGateSelfProtectionStatus`
- `integrationGovernanceStatus`
- `draftPrInventoryModelStatus`
- `nextIntegrationCandidateStatus`
- `stopCreatingPolicyPrStatus`
- `productionReadinessG4GateStatus`
- `observabilityEvidenceGateStatus`
- `chaosLiteRuntimeSimulationStatus`
- `atomicityDeliveryIntegrityStatus`
- `reviewEvidenceTypedSchemaStatus`
- `ownerValuesValidatorStandardStatus`
- `tokenDeploymentLadderStateStatus`
- `safeSuggestedPatchStatus`
- `taskSizeAdvisorStatus`
- `runtimeReadinessBlockerDigestV2Status`
- `dynamicWorkflowWorkerBoundaryV2Status`
- `toolPermissionBoundaryV2Status`
- `roleProfilePluginV2Status`

## Source-Only Contract

v1.0.5 uses synthetic fixtures only. It must not touch IRIS, FUNKY, VOXWEAVE,
CRIPTO-TIP, IRIS-live2d-renderer, VGC-FUNKY-TOKEN, or any target repository.
Representative real PR validation remains `not_started`.

## Readiness Boundary

v1.0.5 does not claim runtime readiness or production readiness. G0 through G3
are never production ready. G4 requires safe evidence for observability, alerts,
rollback, SLO, chaos, secret rotation, and runbook coverage.

## Safe Output Contract

Every v1.0.5 gate emits safe JSON. Raw logs, raw diffs, secret values, endpoint
values, private paths, wallet addresses linked to users, transaction hashes
linked to viewers, and raw payloads are prohibited.
