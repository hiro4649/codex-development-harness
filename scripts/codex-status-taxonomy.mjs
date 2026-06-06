#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

export const HARNESS_VERSION = '1.0.9';
export const MARKER = 'CODEX_QUALITY_HARNESS_FILE v1.0.9';

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
