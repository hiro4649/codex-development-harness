#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.0

export { V110_STATUS_KEYS, V110_ABSORPTION_MAP, buildDefaultV110Statuses } from './codex-v110-token-economy.mjs';

export const HARNESS_VERSION = '1.1.0';
export const MARKER = 'CODEX_QUALITY_HARNESS_FILE v1.1.0';

export const V109_STATUS_KEYS = [
  'v109SelfTestStatus',
  'decisionLedgerStatus',
  'gateLedgerStatus',
  'evidenceSelfReferenceBreakerStatus',
  'versionDimensionSeparationStatus',
  'repairPlanSafeJsonStatus',
  'safeCiFailureArtifactV2Status',
  'requiredCheckClosureV2Status',
  'missingStatusTaxonomyStatus',
  'operatorDigestV4Status',
  'mergeCriticalSummaryStatus',
  'formalEvidencePrecedenceV2Status',
  'remoteArtifactSemanticClassifierStatus',
  'failureTriageEngineStatus',
  'workflowLedgerStatus',
  'ciWatcherStatus',
  'prInventoryReductionStatus',
  'mainReflectionPackageStatus',
  'noDeltaNoPrV2Status',
  'reviewEvidenceProtocolV2Status',
  'runtimeReturnGateStatus',
  'terminalBlockRecoveryV2Status',
  'safeSuggestedPatchV4Status',
  'qualityExplainV3Status',
  'qualityRepairPlanV3Status',
];

export const MISSING_STATUS_CLASSES = [
  'not_applicable_for_lane',
  'not_required_for_product_scope',
  'missing_but_nonblocking',
  'missing_blocking',
  'missing_due_to_artifact_gap',
  'missing_due_to_external_runner',
  'missing_due_to_manual_gate_absent',
  'missing_due_to_future_scope',
];

export const V109_ABSORBED_STATUS_MAP = {
  terminalBlockRecoveryV2Status: ['repairPlanSafeJsonStatus', 'failureTriageEngineStatus', 'ciWatcherStatus'],
  safeSuggestedPatchV4Status: ['repairPlanSafeJsonStatus'],
  qualityExplainV3Status: ['operatorDigestV4Status', 'failureTriageEngineStatus'],
  qualityRepairPlanV3Status: ['repairPlanSafeJsonStatus', 'operatorDigestV4Status', 'failureTriageEngineStatus'],
};

export const EXTERNAL_SOURCE_ABSORPTION_MAP = {
  threatModelFirst: implementedDirectly('threatModelFirstStatus'),
  findingTriage: implementedDirectly('findingTriageStatus'),
  candidatePatchQuarantine: implementedDirectly('candidatePatchQuarantineStatus'),
  patchVerification: implementedDirectly('patchVerificationStatus'),
  sandboxedVerificationLane: implementedDirectly('sandboxedVerificationLaneStatus'),
  recursiveSelfImprovementBoundary: implementedDirectly('recursiveSelfImprovementBoundaryStatus'),
  selfImprovementEvalGate: implementedDirectly('selfImprovementEvalGateStatus'),
  moderationSignalGate: implementedDirectly('moderationSignalGateStatus'),
  memoryGovernance: implementedDirectly('memoryGovernanceV2Status'),
  projectMemoryLedger: implementedDirectly('projectMemoryLedgerStatus'),
  memoryFreshness: implementedDirectly('memoryFreshnessStatus'),
  memoryReviewability: implementedDirectly('memoryReviewabilityStatus'),
  traceToEvalLoop: implementedDirectly('traceToEvalLoopStatus'),
  reviewedFinding: implementedDirectly('reviewedFindingStatus'),
  evalTargetGeneration: implementedDirectly('evalTargetGenerationStatus'),
  dynamicWorkflowSupervisor: implementedDirectly('dynamicWorkflowSupervisorStatus'),
  agentSessionInventory: implementedDirectly('agentSessionInventoryStatus'),
  parallelAgentBudget: implementedDirectly('parallelAgentBudgetStatus'),
  refutationAgent: implementedDirectly('refutationAgentStatus'),
  verificationFanIn: absorbedBy(['verificationFanInStatus', 'verificationFanInV3Status', 'decisionLedgerStatus', 'workflowLedgerStatus']),
  parentThreadFinalAuthority: absorbedBy(['parentThreadFinalAuthorityStatus', 'parentThreadFinalAuthorityV3Status', 'decisionLedgerStatus', 'workflowLedgerStatus']),
  asrTranscriptProvenance: implementedDirectly('asrTranscriptProvenanceStatus'),
  asrExecution: intentionalNonGoal('asr_execution_forbidden_in_source_harness_v109'),
  externalModerationApiCalls: intentionalNonGoal('external_api_calls_forbidden_in_source_harness_v109'),
  sandboxExecution: intentionalNonGoal('sandbox_execution_forbidden_in_source_harness_v109'),
  runtimeIntegration: intentionalNonGoal('runtime_integration_forbidden_in_source_harness_v109'),
};

export const ORCHESTRATION_ABSORPTION_MAP = {
  orchestrationSessionTopology: implementedDirectly('orchestrationSessionTopologyStatus'),
  agentTeamBudget: implementedDirectly('agentTeamBudgetStatus'),
  worktreeIsolationRequired: implementedDirectly('worktreeIsolationRequiredStatus'),
  subagentDefinitionRegistry: implementedDirectly('subagentDefinitionRegistryStatus'),
  agentHookQualityGate: implementedDirectly('agentHookQualityGateStatus'),
  agentMemoryBoundary: implementedDirectly('agentMemoryBoundaryStatus'),
  pmSessionRole: absorbedBy(['workflowLedgerStatus', 'decisionLedgerStatus']),
  architectSessionRole: absorbedBy(['workflowLedgerStatus', 'decisionLedgerStatus']),
  frontendSessionRole: absorbedBy(['workflowLedgerStatus', 'decisionLedgerStatus']),
  backendSessionRole: absorbedBy(['workflowLedgerStatus', 'decisionLedgerStatus']),
  infraDevopsSessionRole: absorbedBy(['workflowLedgerStatus', 'decisionLedgerStatus']),
  securitySessionRole: absorbedBy(['reviewEvidenceProtocolV2Status', 'failureTriageEngineStatus']),
  qaReviewerSessionRole: absorbedBy(['reviewEvidenceProtocolV2Status']),
  technicalWriterSessionRole: absorbedBy(['mainReflectionPackageStatus', 'decisionLedgerStatus']),
  threeLayerSessionTopology: absorbedBy(['orchestrationSessionTopologyStatus', 'workflowLedgerStatus']),
  subagentResultOnlyBoundary: absorbedBy(['parentThreadFinalAuthorityStatus', 'decisionLedgerStatus']),
  agentTeamMailboxBoundary: absorbedBy(['orchestrationSessionTopologyStatus', 'workflowLedgerStatus']),
  worktreeFileIsolationBoundary: absorbedBy(['worktreeIsolationRequiredStatus', 'gateLedgerStatus']),
  claudeMdContextNotAuthority: absorbedBy(['agentMemoryBoundaryStatus', 'evidenceSelfReferenceBreakerStatus']),
  hooksAsEnforcementBoundary: absorbedBy(['agentHookQualityGateStatus', 'requiredCheckClosureV2Status']),
  memoryMarkdownContextBoundary: absorbedBy(['agentMemoryBoundaryStatus', 'memoryGovernanceV2Status']),
  teamSizeBudget3to5: absorbedBy(['agentTeamBudgetStatus']),
  parentFinalAuthorityForTeams: absorbedBy(['parentThreadFinalAuthorityStatus', 'decisionLedgerStatus']),
};

export const REQUIRED_EXTERNAL_SOURCE_CONCEPTS = [
  'threatModelFirst',
  'findingTriage',
  'candidatePatchQuarantine',
  'patchVerification',
  'sandboxedVerificationLane',
  'recursiveSelfImprovementBoundary',
  'selfImprovementEvalGate',
  'moderationSignalGate',
  'memoryGovernance',
  'projectMemoryLedger',
  'memoryFreshness',
  'memoryReviewability',
  'traceToEvalLoop',
  'reviewedFinding',
  'evalTargetGeneration',
  'dynamicWorkflowSupervisor',
  'agentSessionInventory',
  'parallelAgentBudget',
  'refutationAgent',
  'verificationFanIn',
  'parentThreadFinalAuthority',
  'asrTranscriptProvenance',
];

export const REQUIRED_ORCHESTRATION_CONCEPTS = [
  'orchestrationSessionTopology',
  'agentTeamBudget',
  'worktreeIsolationRequired',
  'subagentDefinitionRegistry',
  'agentHookQualityGate',
  'agentMemoryBoundary',
  'pmSessionRole',
  'architectSessionRole',
  'frontendSessionRole',
  'backendSessionRole',
  'infraDevopsSessionRole',
  'securitySessionRole',
  'qaReviewerSessionRole',
  'technicalWriterSessionRole',
  'threeLayerSessionTopology',
  'subagentResultOnlyBoundary',
  'agentTeamMailboxBoundary',
  'worktreeFileIsolationBoundary',
  'claudeMdContextNotAuthority',
  'hooksAsEnforcementBoundary',
  'memoryMarkdownContextBoundary',
  'teamSizeBudget3to5',
  'parentFinalAuthorityForTeams',
];

export function buildStatus(key, status = 'pass', extra = {}) {
  return {
    [key]: {
      status,
      reasonCodes: extra.reasonCodes || [],
      blocking: extra.blocking ?? status === 'fail',
      evidenceConsumed: extra.evidenceConsumed || [],
      safeSummary: extra.safeSummary || {},
      nextSafeAction: extra.nextSafeAction || (status === 'pass' ? 'continue_source_harness_validation' : 'emit_safe_repair_plan'),
      safeSummaryOnly: true,
    },
  };
}

export function classifyMissingStatus(input = {}) {
  const statusClass = String(input.statusClass || input.reasonCode || '');
  if (statusClass === 'missing') {
    return { status: 'fail', reasonCodes: ['plain_missing_forbidden'], safeSummaryOnly: true };
  }
  if (!MISSING_STATUS_CLASSES.includes(statusClass)) {
    return { status: 'fail', reasonCodes: ['missing_status_unclassified'], safeSummaryOnly: true };
  }
  const blocking = statusClass === 'missing_blocking' ||
    statusClass === 'missing_due_to_artifact_gap' ||
    statusClass === 'missing_due_to_external_runner' ||
    statusClass === 'missing_due_to_manual_gate_absent';
  return { status: blocking ? 'blocked' : 'pass', statusClass, blocking, reasonCodes: [statusClass], safeSummaryOnly: true };
}

export function assertNoPlainMissing(value, path = 'root') {
  const failures = [];
  walk(value, path, failures);
  return { status: failures.length ? 'fail' : 'pass', failures, safeSummaryOnly: true };
}

export function validateAbsorptionMap(map, requiredConcepts) {
  const failures = [];
  for (const concept of requiredConcepts) {
    if (!map[concept]) {
      failures.push({ concept, reasonCode: 'required_concept_omitted' });
      continue;
    }
    const entry = map[concept];
    if (!['implemented_directly', 'absorbed_by', 'intentional_non_goal'].includes(entry.mode)) {
      failures.push({ concept, reasonCode: 'absorption_mode_invalid' });
    }
    if (entry.mode === 'implemented_directly' && !entry.status) failures.push({ concept, reasonCode: 'direct_status_required' });
    if (entry.mode === 'absorbed_by' && (!Array.isArray(entry.absorbedBy) || entry.absorbedBy.length === 0)) failures.push({ concept, reasonCode: 'absorbing_status_required' });
    if (entry.mode === 'intentional_non_goal' && !entry.reason) failures.push({ concept, reasonCode: 'non_goal_reason_required' });
  }
  return { status: failures.length ? 'fail' : 'pass', failures, safeSummaryOnly: true };
}

export function implementedDirectly(status) {
  return { mode: 'implemented_directly', status, safeSummaryOnly: true };
}

export function absorbedBy(absorbedByList) {
  return { mode: 'absorbed_by', absorbedBy: absorbedByList, safeSummaryOnly: true };
}

export function intentionalNonGoal(reason) {
  return { mode: 'intentional_non_goal', reason, safeSummaryOnly: true };
}

function walk(value, path, failures) {
  if (value === 'missing') failures.push({ path, reasonCode: 'plain_missing_forbidden' });
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, failures);
}

export function buildDefaultV109Statuses() {
  return Object.fromEntries(V109_STATUS_KEYS.map((key) => {
    const absorbedBy = V109_ABSORBED_STATUS_MAP[key];
    return [
      key,
      buildStatus(key, 'pass', {
        reasonCodes: key === 'v109SelfTestStatus' ? [] : [absorbedBy ? 'absorbed_by_repair_plan_digest_triage' : 'v109_contract_fixture_pass'],
        safeSummary: absorbedBy ? { absorbedBy } : {},
      })[key],
    ];
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ marker: MARKER, harnessVersion: HARNESS_VERSION, missingStatusClasses: MISSING_STATUS_CLASSES, safeSummaryOnly: true }, null, 2));
}
