#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { invalidInput: true }; }
}

export function parseBool(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

export function parseList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function safe(statusKey, status, payload = {}) {
  const out = simpleStatus(statusKey, status, {
    ...payload,
    reasonCodes: uniq(payload.reasonCodes),
    warnings: uniq(payload.warnings),
    safeSummaryOnly: true,
  });
  return scanObjectForUnsafe(out).length
    ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true })
    : out;
}

function notApplicable(statusKey, reasonCode) {
  return safe(statusKey, 'not_applicable', { reasonCodes: [reasonCode] });
}

function taskMode(input, env) {
  return String(input.taskMode || env.CODEX_TASK_MODE || '').trim();
}

function changedFiles(input, env) {
  return parseList(input.changedFiles ?? env.CODEX_CHANGED_FILES);
}

function hasAny(input, keys) {
  return keys.some((key) => parseBool(input[key]));
}

function isHarnessOnly(input, env) {
  const mode = taskMode(input, env);
  const files = changedFiles(input, env);
  if (parseBool(input.harnessOnly) || mode === 'harness_change' || mode === 'target_rollout') return true;
  return files.length > 0 && files.every((file) => /^(AGENTS\.md|README\.md|CODEX_SOURCE_HARNESS_MANIFEST\.json|\.github\/|\.agents\/|docs\/codex\/|docs\/process\/|scripts\/codex-)/.test(file.replace(/\\/g, '/')));
}

function riskClasses(input) {
  return parseList(input.riskClasses || input.riskProfile || input.changedFileClasses);
}

export function buildAgentsDoctrineReport(input = parseJson(process.env.CODEX_AGENTS_DOCTRINE_JSON) || {}, env = process.env) {
  const reasonCodes = [];
  const warnings = [];
  const text = String(input.agentsText || env.CODEX_AGENTS_TEXT || (fs.existsSync('AGENTS.md') ? fs.readFileSync('AGENTS.md', 'utf8') : ''));
  const size = Number(input.size ?? text.length);
  const hasDoctrine = parseBool(input.doctrineSectionExists) || /doctrine/i.test(text);
  const hasRouting = parseBool(input.routingMapExists) || /routing/i.test(text);
  const hasDocsLinks = parseBool(input.docsProcessLinksExist) || /docs\/process/i.test(text);
  if (input.invalidInput) reasonCodes.push('agents_doctrine_failed');
  if (size > Number(input.maxSize || 12000) || parseBool(input.largeManual)) reasonCodes.push('agents_manual_too_large');
  if (parseBool(input.policyBodyInAgents)) reasonCodes.push('agents_manual_too_large');
  if (parseBool(input.sourceTargetDoctrineConflict)) reasonCodes.push('agents_doctrine_failed');
  if (parseBool(input.targetAuthorityMissing)) reasonCodes.push('agents_doctrine_failed');
  if (parseBool(input.activeMarkerMismatch)) reasonCodes.push('active_marker_version_mismatch');
  if (parseBool(input.forbiddenProductPathPolicyMissing)) reasonCodes.push('agents_doctrine_failed');
  if (parseBool(input.docsProcessLinkBroken)) warnings.push('agents_doctrine_link_check_manual');
  if (!input.skipRequiredSections && !(hasDoctrine && hasRouting && hasDocsLinks)) reasonCodes.push('agents_doctrine_failed');
  return safe('agentsDoctrineStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildSkillRoutingReport(input = parseJson(process.env.CODEX_SKILL_ROUTING_JSON) || {}, env = process.env) {
  const selected = parseList(input.selectedSkills || env.CODEX_SELECTED_SKILLS);
  const classes = riskClasses(input);
  const mode = taskMode(input, env);
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('skill_routing_failed');
  if (selected.length > 5) reasonCodes.push('skill_count_exceeded');
  if (selected.length === 5) warnings.push('skill_count_at_limit');
  if ((classes.includes('product_relevant') || parseBool(input.productRelevant)) && !selected.some((item) => /product|review|evidence/i.test(item))) reasonCodes.push('skill_routing_failed');
  if ((classes.includes('runtime_relevant') || classes.includes('tx_relevant') || parseBool(input.runtimeRelevant)) && !selected.some((item) => /runtime|tx|safety/i.test(item))) reasonCodes.push('skill_routing_failed');
  if ((mode === 'target_rollout' || classes.includes('target_rollout')) && !selected.some((item) => /target|harness|evidence/i.test(item))) reasonCodes.push('skill_routing_failed');
  if (parseBool(input.unknownTaskWithoutRoute)) reasonCodes.push('skill_routing_failed');
  if (parseBool(input.contradictsDoctrine)) reasonCodes.push('skill_routing_failed');
  return safe('skillRoutingStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, skillCount: selected.length });
}

export function buildSkillLoadBudgetReport(input = parseJson(process.env.CODEX_SKILL_LOAD_BUDGET_JSON) || {}) {
  const loaded = parseList(input.loadedSkills);
  const count = Number(input.loadedSkillCount ?? loaded.length);
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('skill_load_budget_exceeded');
  if (count > 5) reasonCodes.push('skill_load_budget_exceeded');
  if (count > 4) warnings.push('skill_load_budget_near_limit');
  if (parseBool(input.skillBodyTooLarge)) reasonCodes.push('skill_load_budget_exceeded');
  if (parseBool(input.duplicateSkillsLoaded)) reasonCodes.push('skill_load_budget_exceeded');
  if (parseBool(input.conflictsWithDoctrine)) reasonCodes.push('skill_load_budget_exceeded');
  if (parseBool(input.loadsRawProductDocs)) reasonCodes.push('skill_load_budget_exceeded');
  if (parseBool(input.privateProductionTraceIncluded)) reasonCodes.push('raw_production_data_forbidden');
  return safe('skillLoadBudgetStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, loadedSkillCount: count });
}

export function buildSkillDriftReport(input = parseJson(process.env.CODEX_SKILL_DRIFT_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('skill_drift_detected');
  if (parseBool(input.oldHarnessVersion)) reasonCodes.push('skill_drift_detected');
  if (parseBool(input.targetSpecificSkillHotfixDeleted)) reasonCodes.push('target_hotfix_overwritten');
  if (parseBool(input.productReadinessMisclaimed)) reasonCodes.push('skill_drift_detected');
  if (parseBool(input.forbiddenProductPathAllowed)) reasonCodes.push('skill_drift_detected');
  if (parseBool(input.evidenceLinkMissing)) reasonCodes.push('skill_evidence_link_missing');
  if (parseBool(input.contradictsManifest)) reasonCodes.push('skill_drift_detected');
  if (parseBool(input.oldHistoryOnly)) warnings.push('skill_history_marker');
  return safe('skillDriftStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildAgentSessionGovernanceReport(input = parseJson(process.env.CODEX_AGENT_SESSION_GOVERNANCE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.multiAgent) && !parseBool(input.parallelSessions)) return notApplicable('agentSessionGovernanceStatus', 'single_agent_session');
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.sameBranchMultiplePushers)) reasonCodes.push('agent_session_conflict');
  if (parseBool(input.scopeExpandedBeforeComplete)) reasonCodes.push('agent_session_conflict');
  if (parseBool(input.needsInputMerged)) reasonCodes.push('agent_needs_input_merge_blocked');
  if (parseBool(input.productCodeChangedWithoutRuntimeDenied)) reasonCodes.push('agent_session_conflict');
  if (parseBool(input.parallelSameFileChanged)) reasonCodes.push('agent_session_conflict');
  if (parseBool(input.sessionStateMissing)) reasonCodes.push('agent_session_conflict');
  if (parseBool(input.staleSessionExists)) warnings.push('agent_session_stale');
  return safe('agentSessionGovernanceStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildAgentContainmentBoundaryReport(input = parseJson(process.env.CODEX_AGENT_CONTAINMENT_BOUNDARY_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.credentialInContext)) reasonCodes.push('agent_containment_boundary_failed');
  if (parseBool(input.egressCapabilityMissing)) reasonCodes.push('external_content_trust_violation');
  if (parseBool(input.allowedDomainNotCapabilityRecorded)) reasonCodes.push('external_content_trust_violation');
  if (parseBool(input.symlinkValidationUnsafe)) reasonCodes.push('agent_containment_boundary_failed');
  if (parseBool(input.externalContentTrusted)) reasonCodes.push('external_content_trust_violation');
  if (parseBool(input.toolPermissionTooBroad)) reasonCodes.push('tool_permission_too_broad');
  if (parseBool(input.rawExternalContentInArtifact)) reasonCodes.push('agent_containment_boundary_failed');
  if (parseBool(input.writePermissionForReadOnly)) reasonCodes.push('tool_permission_too_broad');
  if (parseBool(input.networkAvailableButNotNeeded)) warnings.push('tool_permission_not_minimized');
  return safe('agentContainmentBoundaryStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildEvalTraceHarvestReport(input = parseJson(process.env.CODEX_EVAL_TRACE_HARVEST_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.tracePresent)) return notApplicable('evalTraceHarvestStatus', 'eval_trace_not_present');
  const reasonCodes = [];
  const warnings = [];
  if (!input.observedBehavior || !input.expectedBehavior) reasonCodes.push('eval_trace_invalid');
  if (parseBool(input.rawProductionDataIncluded) || parseBool(input.personalDataIncluded)) reasonCodes.push('raw_production_data_forbidden');
  if (!input.failureCluster && parseBool(input.actionable)) reasonCodes.push('eval_trace_invalid');
  if (parseBool(input.ambiguousFeedbackAutoTask)) reasonCodes.push('eval_trace_invalid');
  if (!input.safeScope || !parseList(input.doNotTouchList).length) reasonCodes.push('eval_trace_invalid');
  if (parseBool(input.manualReviewRequired)) warnings.push('eval_trace_manual_review');
  return safe('evalTraceHarvestStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildOperatorVisibleDeltaReport(input = parseJson(process.env.CODEX_OPERATOR_VISIBLE_DELTA_JSON) || {}) {
  const productVisible = parseBool(input.productVisibleChange) || parseBool(input.uiApiOutputChange);
  const runtimeReadinessClaimed = parseBool(input.runtimeReadinessClaimed);
  if (parseBool(input.docsOnly) || parseBool(input.harnessOnly)) return notApplicable('operatorVisibleDeltaStatus', 'no_product_visible_delta');
  if (!productVisible && !runtimeReadinessClaimed && isHarnessOnly(input, process.env)) return notApplicable('operatorVisibleDeltaStatus', 'no_product_visible_delta');
  if (!productVisible && !runtimeReadinessClaimed) return notApplicable('operatorVisibleDeltaStatus', 'no_product_visible_delta');
  const reasonCodes = [];
  if (!input.beforeVisibleBehavior || !input.afterVisibleBehavior || !input.proofCommand) reasonCodes.push('operator_visible_delta_missing');
  if (runtimeReadinessClaimed && !input.artifactLink) reasonCodes.push('operator_visible_delta_missing');
  if (parseBool(input.productionReadinessClaimed) && !parseBool(input.goNoGoEvidencePresent)) reasonCodes.push('operator_visible_delta_missing');
  return safe('operatorVisibleDeltaStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildTraceToEvalCandidateReport(input = parseJson(process.env.CODEX_TRACE_TO_EVAL_CANDIDATE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.tracePresent)) return notApplicable('traceToEvalCandidateStatus', 'trace_to_eval_not_present');
  const reasonCodes = [];
  if (!input.expectedBehavior || !input.observedFailure || !input.sourceEvidence) reasonCodes.push('trace_to_eval_candidate_invalid');
  if (!input.targetedEvalCommand) reasonCodes.push('trace_to_eval_candidate_invalid');
  if (!input.regressionEvalCommand) reasonCodes.push('trace_to_eval_candidate_invalid');
  if (!input.safeScope || !parseList(input.doNotTouchList).length) reasonCodes.push('trace_to_eval_candidate_invalid');
  if (parseBool(input.rawProductionDataIncluded)) reasonCodes.push('raw_production_data_forbidden');
  if (parseBool(input.ambiguousTraceForcedIntoTask)) reasonCodes.push('trace_to_eval_candidate_invalid');
  return safe('traceToEvalCandidateStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildSubagentGovernanceReport(input = parseJson(process.env.CODEX_SUBAGENT_GOVERNANCE_JSON) || {}) {
  const classes = riskClasses(input);
  if (!parseBool(input.forceCheck) && !classes.length && !parseBool(input.subagentUsed)) return notApplicable('subagentGovernanceStatus', 'subagent_not_required');
  const roles = parseList(input.roles);
  const reasonCodes = [];
  const warnings = [];
  if ((classes.includes('security_relevant') || parseBool(input.securityRelevant)) && !roles.includes('security')) reasonCodes.push('subagent_governance_failed');
  if ((classes.includes('runtime_relevant') || parseBool(input.runtimeRelevant)) && !roles.includes('runtime_safety')) reasonCodes.push('subagent_governance_failed');
  if ((classes.includes('architecture') || parseBool(input.architectureChange)) && !roles.includes('architecture')) reasonCodes.push('subagent_governance_failed');
  if (parseBool(input.rawOutputIncluded)) reasonCodes.push('subagent_raw_output_forbidden');
  if (parseBool(input.runtimeReadyApprovedWithoutOracle)) reasonCodes.push('subagent_governance_failed');
  if (parseBool(input.contradictsChangedFileClassification)) reasonCodes.push('subagent_governance_failed');
  if (classes.includes('docs_only') && roles.length > 2) warnings.push('subagent_docs_only_too_heavy');
  return safe('subagentGovernanceStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildSubagentReviewMatrixReport(input = parseJson(process.env.CODEX_SUBAGENT_REVIEW_MATRIX_JSON) || {}) {
  const changeClass = String(input.changeClass || input.taskClass || '').trim();
  if (!parseBool(input.forceCheck) && !changeClass) return notApplicable('subagentReviewMatrixStatus', 'subagent_matrix_not_required');
  const roles = parseList(input.roles);
  const matrix = {
    docs_only: [],
    harness_only: ['evidence_integrity'],
    workflow_change: ['security', 'evidence_integrity'],
    target_rollout: ['evidence_integrity', 'code_quality'],
    product_relevant: ['product_fit', 'code_quality', 'evidence_integrity'],
    security_relevant: ['security', 'architecture', 'evidence_integrity'],
    runtime_relevant: ['runtime_safety', 'architecture', 'evidence_integrity'],
    tx_relevant: ['runtime_safety', 'architecture', 'evidence_integrity'],
    agent_orchestration: ['architecture', 'evidence_integrity'],
  };
  const required = matrix[changeClass] || [];
  const missing = required.filter((role) => !roles.includes(role));
  const reasonCodes = [];
  if (missing.length) reasonCodes.push('subagent_governance_failed');
  if (parseBool(input.reviewedItemsEmpty)) reasonCodes.push('subagent_governance_failed');
  if (parseBool(input.roleContradictsChangedFiles)) reasonCodes.push('subagent_governance_failed');
  return safe('subagentReviewMatrixStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, missingRoles: missing });
}

export function buildPrismaStateMachineSchemaReport(input = parseJson(process.env.CODEX_PRISMA_STATE_MACHINE_SCHEMA_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.txJobModelChanged) && !parseBool(input.runtimeReadinessClaimed)) return notApplicable('stateMachineSchemaStatus', 'no_state_machine_surface');
  const fields = parseList(input.fields);
  const reasonCodes = [];
  if (parseBool(input.processedBooleanOnly)) reasonCodes.push('processed_boolean_only_state_machine');
  if (parseBool(input.runtimeReadinessClaimed)) {
    for (const field of ['status', 'attempt', 'updatedAt']) if (!fields.includes(field)) reasonCodes.push('state_machine_schema_missing');
    if (!(fields.includes('lockedBy') || fields.includes('owner') || fields.includes('leaseUntil') || fields.includes('lockExpiresAt'))) reasonCodes.push('state_machine_schema_missing');
  }
  if (parseBool(input.txPath) && !fields.includes('txHash')) reasonCodes.push('state_machine_schema_missing');
  if (parseBool(input.receiptPath) && !fields.includes('receiptStatus')) reasonCodes.push('state_machine_schema_missing');
  if (parseBool(input.chainSpecific) && !fields.includes('chainId')) reasonCodes.push('state_machine_schema_missing');
  if (parseBool(input.schemaChanged) && !parseBool(input.migrationBackfillRollbackPlan)) reasonCodes.push('state_machine_schema_missing');
  if (parseBool(input.dateNowBatchIdOnly)) reasonCodes.push('state_machine_schema_missing');
  return safe('stateMachineSchemaStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildStateTransitionHelperReport(input = parseJson(process.env.CODEX_STATE_TRANSITION_HELPER_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.stateFieldsAdded)) return notApplicable('stateTransitionHelperStatus', 'no_state_transition_surface');
  const reasonCodes = [];
  const warnings = [];
  if (!parseBool(input.helperPresent)) reasonCodes.push('state_transition_helper_missing');
  if (parseBool(input.helperMutatesDbDirectly)) reasonCodes.push('state_transition_helper_missing');
  if (!parseBool(input.transitionTestPresent)) reasonCodes.push('state_transition_helper_missing');
  if (!parseBool(input.invalidTransitionTested)) reasonCodes.push('state_transition_helper_missing');
  if (parseBool(input.runtimeJob) && !parseBool(input.claimTimeoutRetryTransitionPresent)) reasonCodes.push('state_transition_helper_missing');
  if (!parseBool(input.safeErrorStatesPresent)) reasonCodes.push('state_transition_helper_missing');
  if (parseBool(input.manualOnlyEvidence)) warnings.push('state_transition_manual_only');
  return safe('stateTransitionHelperStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildReceiptEvidenceSchemaReport(input = parseJson(process.env.CODEX_RECEIPT_EVIDENCE_SCHEMA_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.receiptRequired) && !parseBool(input.receiptEvidencePresent)) return notApplicable('receiptEvidenceSchemaStatus', 'receipt_evidence_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.privateKeyIncluded) || parseBool(input.rawRpcUrlIncluded) || parseBool(input.rawPayloadIncluded) || parseBool(input.rawLogIncluded)) reasonCodes.push('receipt_private_data_forbidden');
  if (parseBool(input.receiptEvidencePresent) && !parseBool(input.chainIdPresent)) reasonCodes.push('receipt_evidence_schema_failed');
  if (parseBool(input.receiptRequired) && !parseBool(input.storagePolicyPresent)) reasonCodes.push('receipt_evidence_schema_failed');
  if (parseBool(input.runtimeReadinessClaimed) && parseBool(input.privateReceiptData)) reasonCodes.push('receipt_private_data_forbidden');
  if (parseBool(input.pending)) warnings.push('receipt_evidence_pending');
  return safe('receiptEvidenceSchemaStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildWorkerReadinessSequenceReport(input = parseJson(process.env.CODEX_WORKER_READINESS_SEQUENCE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.workerRelevant) && !parseBool(input.runtimeReadinessClaimed)) return notApplicable('workerReadinessSequenceStatus', 'worker_readiness_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.workerEntrypointBeforeSchemaHelper)) reasonCodes.push('worker_readiness_sequence_failed');
  if (parseBool(input.txSenderBeforeReceiptPolicy)) reasonCodes.push('worker_readiness_sequence_failed');
  if (parseBool(input.claimRetryBeforeIdempotencyKey)) reasonCodes.push('worker_readiness_sequence_failed');
  if (parseBool(input.runtimeReadinessClaimed) && !parseBool(input.stagingNoTxEvidencePresent)) reasonCodes.push('worker_readiness_sequence_failed');
  if (parseBool(input.jobRunIntegrationBeforeFoundation)) reasonCodes.push('worker_readiness_sequence_failed');
  if (parseBool(input.txPathWithoutOwnershipEvidence)) reasonCodes.push('runtime_job_ownership_missing');
  return safe('workerReadinessSequenceStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildEvidenceMinimalityReport(input = parseJson(process.env.CODEX_EVIDENCE_MINIMALITY_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.rawLogsInPrBody) || parseBool(input.rawDiffsInPrBody)) reasonCodes.push('evidence_minimality_failed');
  if (parseBool(input.requiredEvidenceMissingReplacedByVerbosity)) reasonCodes.push('evidence_minimality_failed');
  if (parseBool(input.productPrLacksRequiredEvidence)) reasonCodes.push('product_relevant_evidence_missing');
  if (parseBool(input.runtimeReadinessClaimWithoutArtifactButLongExplanation)) reasonCodes.push('evidence_minimality_failed');
  if (parseBool(input.prBodyTooLong)) warnings.push('pr_body_too_large');
  if (parseBool(input.repeatedEvidence)) warnings.push('evidence_duplicate');
  return safe('evidenceMinimalityStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildEvidenceDedupReport(input = parseJson(process.env.CODEX_EVIDENCE_DEDUP_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.conflictingManualConfirmationBlocks)) reasonCodes.push('evidence_dedup_conflict');
  if (parseBool(input.conflictingHeadSha)) reasonCodes.push('evidence_dedup_conflict');
  if (parseBool(input.conflictingRuntimeReadinessClaim)) reasonCodes.push('evidence_dedup_conflict');
  if (parseBool(input.productCodeChangedConflict)) reasonCodes.push('evidence_dedup_conflict');
  if (parseBool(input.statusRepeatedManyTimes)) warnings.push('evidence_duplicate');
  if (parseBool(input.largeChangedFileListPasted)) warnings.push('pr_body_too_large');
  return safe('evidenceDedupStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildSafeArtifactNextActionReport(input = parseJson(process.env.CODEX_SAFE_ARTIFACT_NEXT_ACTION_JSON) || {}) {
  const classification = String(input.classification || '');
  const reasonCodes = [];
  if (parseBool(input.failureArtifact) && !classification) reasonCodes.push('safe_artifact_next_action_missing');
  if (parseBool(input.productEvidenceMissing) && classification === 'body_only_repair') reasonCodes.push('safe_artifact_next_action_missing');
  if (parseBool(input.runtimeReadinessGap) && classification === 'body_only_repair') reasonCodes.push('safe_artifact_next_action_missing');
  if (parseBool(input.unsafeArtifact) && /rerun/i.test(classification)) reasonCodes.push('safe_artifact_next_action_missing');
  if (parseBool(input.baselineFixtureDrift) && classification === 'body_only_repair') reasonCodes.push('safe_artifact_next_action_missing');
  return safe('safeArtifactNextActionStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, classification: classification || 'not_applicable' });
}

export function buildSkillEvidenceLinkReport(input = parseJson(process.env.CODEX_SKILL_EVIDENCE_LINK_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.missingLink)) reasonCodes.push('skill_evidence_link_missing');
  if (parseBool(input.contradictsManifest)) reasonCodes.push('skill_evidence_link_missing');
  if (parseBool(input.productReadyWithoutRuntimeEvidence)) reasonCodes.push('skill_evidence_link_missing');
  if (parseBool(input.obsoleteWorkflowReference)) reasonCodes.push('skill_evidence_link_missing');
  if (parseBool(input.bypassesDoNotTouchList)) reasonCodes.push('skill_evidence_link_missing');
  if (parseBool(input.oldEvidence)) warnings.push('skill_evidence_old');
  return safe('skillEvidenceLinkStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function runV095GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder();
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
