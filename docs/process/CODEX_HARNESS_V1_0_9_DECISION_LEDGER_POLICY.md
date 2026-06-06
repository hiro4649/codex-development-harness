<!-- CODEX_QUALITY_HARNESS_FILE v1.0.9 -->

# Source HARNESS v1.0.9 Decision Ledger Policy

v1.0.9 is a source-HARNESS-only extension of v1.0.8. It preserves v1.0.8
safety while reducing state sprawl through a single safe Decision Ledger and a
derived Gate Ledger.

## Non-Goals

- No target repo rollout.
- No product code changes.
- No runtime connection.
- No production go.
- No deploy, funded transaction, wallet/RPC, YouTube API operation, TTS/ASR/Live2D
  runtime call, DB write, DB export, trusted loader enablement, or real dataset
  row insertion.
- No owner confirmation replacement.
- No raw logs.

## Decision Ledger

The Decision Ledger is the canonical safe JSON object for merge, runtime, review,
quality-gate, and evidence state. PR bodies and rendered docs are human summaries
only. Merge decisions must use GitHub Checks API metadata plus safe artifact
ledger data, not PR body text alone.

Required version dimensions are separate:

- `activeHarnessVersion`
- `targetHarnessVersion`
- `evidenceSchemaVersion`
- `profileTemplateVersion`
- `futureHarnessArtifact`
- `upgradePath`

Quality-gate pass alone never permits merge. Same-head required checks,
independent review evidence, and review evidence protocol closure are required
for merge consideration.

## Gate Ledger

The Gate Ledger derives from the Decision Ledger and groups state into:

- `mergeCritical`
- `productEvidence`
- `reviewEvidence`
- `runtimeBoundary`
- `productionBoundary`
- `manualGateBoundary`
- `advisoryOrNotApplicable`

Every group exposes `status`, `blocking`, `reasonCodes`, `evidenceConsumed`,
`safeSummary`, and `nextSafeAction`.

## Safe Repair Plans

Every blocking failure should emit `codex-repair-plan.safe.json` when safe. The
repair plan must never require raw logs, secrets, private paths, provider
payloads, wallet/RPC values, or user data. Missing safe artifacts are blockers,
not passes.

## Absorbed v1.0.9 Status Semantics

The following v1.0.9 status names are retained for compatibility but are absorbed
by the concrete Decision Ledger implementation surfaces:

- `terminalBlockRecoveryV2Status`: absorbed by
  `repairPlanSafeJsonStatus`, `failureTriageEngineStatus`, and
  `ciWatcherStatus`.
- `safeSuggestedPatchV4Status`: absorbed by `repairPlanSafeJsonStatus`.
- `qualityExplainV3Status`: absorbed by `operatorDigestV4Status` and
  `failureTriageEngineStatus`.
- `qualityRepairPlanV3Status`: absorbed by `repairPlanSafeJsonStatus`,
  `operatorDigestV4Status`, and `failureTriageEngineStatus`.

## External-Source Absorption Map

These external-source-derived concepts are durable v1.0.9 source-harness
mappings:

- `threatModelFirst`: implemented directly by `threatModelFirstStatus`.
- `findingTriage`: implemented directly by `findingTriageStatus`.
- `candidatePatchQuarantine`: implemented directly by
  `candidatePatchQuarantineStatus`.
- `patchVerification`: implemented directly by `patchVerificationStatus`.
- `sandboxedVerificationLane`: implemented directly by
  `sandboxedVerificationLaneStatus`.
- `recursiveSelfImprovementBoundary`: implemented directly by
  `recursiveSelfImprovementBoundaryStatus`.
- `selfImprovementEvalGate`: implemented directly by
  `selfImprovementEvalGateStatus`.
- `moderationSignalGate`: implemented directly by `moderationSignalGateStatus`.
- `memoryGovernance`: implemented directly by `memoryGovernanceV2Status`.
- `projectMemoryLedger`: implemented directly by `projectMemoryLedgerStatus`.
- `memoryFreshness`: implemented directly by `memoryFreshnessStatus`.
- `memoryReviewability`: implemented directly by `memoryReviewabilityStatus`.
- `traceToEvalLoop`: implemented directly by `traceToEvalLoopStatus`.
- `reviewedFinding`: implemented directly by `reviewedFindingStatus`.
- `evalTargetGeneration`: implemented directly by `evalTargetGenerationStatus`.
- `dynamicWorkflowSupervisor`: implemented directly by
  `dynamicWorkflowSupervisorStatus`.
- `agentSessionInventory`: implemented directly by
  `agentSessionInventoryStatus`.
- `parallelAgentBudget`: implemented directly by `parallelAgentBudgetStatus`.
- `refutationAgent`: implemented directly by `refutationAgentStatus`.
- `verificationFanIn`: implemented directly by `verificationFanInStatus` and
  `verificationFanInV3Status`, and absorbed by `decisionLedgerStatus` and
  `workflowLedgerStatus`.
- `parentThreadFinalAuthority`: implemented directly by
  `parentThreadFinalAuthorityStatus` and `parentThreadFinalAuthorityV3Status`,
  and absorbed by `decisionLedgerStatus` and `workflowLedgerStatus`.
- `asrTranscriptProvenance`: implemented directly by
  `asrTranscriptProvenanceStatus`.
- ASR execution, external moderation API calls, sandbox execution, and runtime
  integration are intentional non-goals in v1.0.9. v1.0.9 records provenance
  and boundaries only; it does not execute ASR, call external APIs, run sandboxed
  target code, or wire runtime paths.

## 8-Session And Orchestration Absorption Map

These orchestration concepts are durable v1.0.9 source-harness mappings:

- `orchestrationSessionTopology`: implemented directly by
  `orchestrationSessionTopologyStatus`.
- `agentTeamBudget`: implemented directly by `agentTeamBudgetStatus`.
- `worktreeIsolationRequired`: implemented directly by
  `worktreeIsolationRequiredStatus`.
- `subagentDefinitionRegistry`: implemented directly by
  `subagentDefinitionRegistryStatus`.
- `agentHookQualityGate`: implemented directly by `agentHookQualityGateStatus`.
- `agentMemoryBoundary`: implemented directly by `agentMemoryBoundaryStatus`.
- `pmSessionRole`, `architectSessionRole`, `frontendSessionRole`,
  `backendSessionRole`, and `infraDevopsSessionRole`: absorbed by
  `workflowLedgerStatus` and `decisionLedgerStatus`.
- `securitySessionRole`: absorbed by `reviewEvidenceProtocolV2Status` and
  `failureTriageEngineStatus`.
- `qaReviewerSessionRole`: absorbed by `reviewEvidenceProtocolV2Status`.
- `technicalWriterSessionRole`: absorbed by `mainReflectionPackageStatus` and
  `decisionLedgerStatus`.
- `threeLayerSessionTopology`: absorbed by `orchestrationSessionTopologyStatus`
  and `workflowLedgerStatus`.
- `subagentResultOnlyBoundary`: absorbed by `parentThreadFinalAuthorityStatus`
  and `decisionLedgerStatus`.
- `agentTeamMailboxBoundary`: absorbed by `orchestrationSessionTopologyStatus`
  and `workflowLedgerStatus`.
- `worktreeFileIsolationBoundary`: absorbed by `worktreeIsolationRequiredStatus`
  and `gateLedgerStatus`.
- `claudeMdContextNotAuthority`: absorbed by `agentMemoryBoundaryStatus` and
  `evidenceSelfReferenceBreakerStatus`. Context files are context, not
  enforcement.
- `hooksAsEnforcementBoundary`: absorbed by `agentHookQualityGateStatus` and
  `requiredCheckClosureV2Status`.
- `memoryMarkdownContextBoundary`: absorbed by `agentMemoryBoundaryStatus` and
  `memoryGovernanceV2Status`.
- `teamSizeBudget3to5`: absorbed by `agentTeamBudgetStatus`.
- `parentFinalAuthorityForTeams`: absorbed by `parentThreadFinalAuthorityStatus`
  and `decisionLedgerStatus`.

## CI Failure Diagnosis

Required check failures use safe metadata and safe artifacts only. Raw logs are
forbidden. A failed required check blocks merge even when quality-gate passes.

## Missing Status Taxonomy

Plain `missing` is forbidden at top level. Missing state must use one of:

- `not_applicable_for_lane`
- `not_required_for_product_scope`
- `missing_but_nonblocking`
- `missing_blocking`
- `missing_due_to_artifact_gap`
- `missing_due_to_external_runner`
- `missing_due_to_manual_gate_absent`
- `missing_due_to_future_scope`

## Operator Digest

Human-facing operator digest must be exactly five lines:

1. `Current state:`
2. `Hard blocker:`
3. `Allowed now:`
4. `Forbidden now:`
5. `One safe next action:`

Detailed state goes to safe artifacts only.

## Profile Stubs

Source-level profile stubs register invariants only. They do not implement target
behavior.

- VOXWEAVE: Decision Ledger required, PR inventory reduction required, review/QG
  separation, no runtime/TTS/ASR readiness by default.
- IRIS-live2d-renderer: priority1 BLOCKED carryover, trusted loader disabled,
  future motion labels non-executable, fixture evidence not real evidence.
- FUNKY: backend cwd evidence precedence, D8 safe DB read export lane separation,
  no DB export, no DB query, no funded tx, no deploy.
- IRIS: priority1 BLOCKED carryover, dataset audit boundary, candidate execution
  boundary, adapter guard, memory privacy, production go blocked.
- CRIPTO-TIP: safe CI failure artifact required, no custody, no wallet/RPC/deploy,
  no YouTube/legal compliance claim, no Super Chat bypass, no token sale,
  exchange service, investment advice, donation pressure, or parasocial
  monetization.
- VGC-TOKEN: token stage artifact, owner-values workflow, deploy approval state
  machine, no deploy, funded tx, governance tx, BscScan verification, or readiness
  claim.

## Safety

Runtime and production readiness default to false. Advisory review, subagent,
subthread, or body-only governance artifacts never become merge authority.
