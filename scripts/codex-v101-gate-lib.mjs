#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, readText } from './codex-v080-lib.mjs';

export const V101_STATUS_KEYS = [
  'primeDirectiveStatus',
  'outcomeContractStatus',
  'sourceOfTruthOwnershipStatus',
  'oldPathDispositionStatus',
  'planReviewerWorkerStatus',
  'antiAccretionStatus',
  'visibleAcceptanceEvidenceStatus',
  'toolchainAvailabilityStatus',
  'nodeAvailabilityStatus',
  'npmAvailabilityStatus',
  'githubCliAvailabilityStatus',
  'githubAuthStatus',
  'shellPathProfileStatus',
  'parentHarnessPreflightStatus',
  'harnessSourceGatePreconditionStatus',
  'localBranchInvariantStatus',
  'targetHeadInvariantStatus',
  'originMainDriftStatus',
  'sameHeadMainQualityGateStatus',
  'localTargetGateBoundedStatus',
  'localGateReportContractStatus',
  'jsonReportShapeStatus',
  'localGateSideEffectStatus',
  'pilotInputCleanlinessStatus',
  'trackedGeneratedArtifactStatus',
  'currentHeadEvidenceField',
  'harnessOnlyDriftClassificationStatus',
  'smallProductPrFastPathStatus',
  'selfTestFixtureIsolationStatus',
  'authoritativeProductEvidenceStatus',
  'targetQualityOwnerActionStatus',
  'runtimeAdoptionSequenceStatus',
  'v101SelfTestStatus',
];

export const V101_REASON_CODES = [
  'prime_directive_missing',
  'outcome_contract_missing',
  'source_of_truth_owner_missing',
  'old_path_disposition_missing',
  'plan_reviewer_wrong_owner',
  'plan_reviewer_missing_cutover',
  'plan_reviewer_weak_evidence',
  'anti_accretion_dual_active_path',
  'visible_acceptance_evidence_missing',
  'visible_acceptance_evidence_test_only',
  'toolchain_node_missing',
  'toolchain_npm_missing',
  'toolchain_gh_missing',
  'github_auth_missing',
  'parent_harness_preflight_failed',
  'target_local_path_ambiguous',
  'target_remote_identity_mismatch',
  'local_branch_not_main',
  'head_not_origin_main',
  'origin_main_drift_without_same_head_quality_gate',
  'same_head_main_quality_gate_missing',
  'local_target_gate_unbounded',
  'local_gate_json_missing',
  'local_gate_json_empty',
  'local_gate_json_parse_failed',
  'local_gate_timeout',
  'local_gate_human_text_mixed_with_json',
  'local_gate_stdout_stderr_empty_timeout',
  'local_gate_report_path_missing',
  'local_gate_unknown_report_contract',
  'local_gate_tracked_file_side_effect',
  'local_gate_branch_mutation',
  'local_gate_head_mutation',
  'pilot_input_dirty',
  'tracked_generated_artifact_created',
  'small_product_pr_fast_path_ineligible',
  'self_test_fixture_isolation_failed',
  'authoritative_product_evidence_conflict',
  'target_quality_owner_action_ambiguous',
  'runtime_adoption_sequence_violation',
];

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function bool(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

function any(input, keys) {
  return keys.some((key) => bool(input[key]));
}

function status(statusKey, state, payload = {}) {
  const report = simpleStatus(statusKey, state, {
    ...payload,
    reasonCodes: uniq(payload.reasonCodes),
    warnings: uniq(payload.warnings),
    safeSummaryOnly: true,
  });
  return scanObjectForUnsafe(report).length
    ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true })
    : report;
}

function pass(statusKey, payload = {}) {
  return status(statusKey, 'pass', payload);
}

function fail(statusKey, reasonCodes, payload = {}) {
  return status(statusKey, 'fail', { ...payload, reasonCodes });
}

function commandOk(command, args = ['--version']) {
  const candidates = process.platform === 'win32' && !/\.(?:cmd|exe)$/i.test(command)
    ? [command, `${command}.cmd`, `${command}.exe`]
    : [command];
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, args, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000,
        shell: process.platform === 'win32' && /\.cmd$/i.test(candidate),
      });
      if (result.status === 0) return true;
    } catch {
      // Try the next platform-specific command candidate.
    }
  }
  return false;
}

function gitValue(args) {
  try {
    const result = spawnSync('git', args, { encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
    return result.status === 0 ? String(result.stdout || '').trim() : '';
  } catch {
    return '';
  }
}

export function captureLocalGateSideEffectSnapshot() {
  return {
    branch: gitValue(['branch', '--show-current']),
    head: gitValue(['rev-parse', 'HEAD']),
    statusShort: gitValue(['status', '--short', '--untracked-files=no']),
    trackedFiles: gitValue(['diff', '--name-only']).split(/\r?\n/).filter(Boolean),
  };
}

export function buildPrimeDirectiveReport(input = {}) {
  const text = String(input.text ?? readText('AGENTS.md') ?? '');
  const required = ['truth', 'trust', 'security', 'maintainability', 'product value', 'smallest correct change'];
  const missing = required.filter((word) => !text.toLowerCase().includes(word));
  if (missing.length || bool(input.ruleDumpOnly)) return fail('primeDirectiveStatus', ['prime_directive_missing'], { missing });
  return pass('primeDirectiveStatus');
}

export function buildOutcomeContractReport(input = {}) {
  if (!bool(input.productBehaviorChange)) return pass('outcomeContractStatus');
  const required = ['replacedBehavior', 'expectedOutcome', 'sourceOfTruthOwner', 'oldPathDisposition', 'doneEvidence'];
  const missing = required.filter((key) => !input[key]);
  const reasons = [];
  if (missing.length) reasons.push('outcome_contract_missing');
  if (String(input.doneEvidence || '').toLowerCase() === 'test_only') reasons.push('visible_acceptance_evidence_test_only');
  if (bool(input.runtimeReadinessClaimed) || bool(input.productionReadinessClaimed)) reasons.push('outcome_contract_missing');
  return reasons.length ? fail('outcomeContractStatus', reasons, { missing }) : pass('outcomeContractStatus');
}

export function buildSourceOfTruthOwnershipReport(input = {}) {
  const required = ['ownerModule', 'ownerFileOrPackage', 'publicContract', 'downstreamConsumers', 'forbiddenDuplicateOwners'];
  const missing = required.filter((key) => !input[key] && !Array.isArray(input[key]));
  const reasons = [];
  if (missing.length) reasons.push('source_of_truth_owner_missing');
  if (any(input, ['duplicateOwner', 'testFixtureOwner', 'docsOnlyOwner'])) reasons.push('source_of_truth_owner_missing');
  return reasons.length ? fail('sourceOfTruthOwnershipStatus', reasons, { missing }) : pass('sourceOfTruthOwnershipStatus');
}

export function buildOldPathDispositionReport(input = {}) {
  const allowed = ['remove', 'redirect', 'deprecate', 'compat_keep_with_owner', 'not_applicable'];
  if (!allowed.includes(String(input.disposition || ''))) return fail('oldPathDispositionStatus', ['old_path_disposition_missing']);
  return pass('oldPathDispositionStatus', { disposition: input.disposition });
}

export function buildPlanReviewerWorkerReport(input = {}) {
  const reasons = [];
  const reviewers = new Set(input.reviewers || []);
  for (const reviewer of ['owner_reviewer', 'cutover_reviewer', 'evidence_reviewer']) {
    if (!reviewers.has(reviewer)) reasons.push('plan_reviewer_weak_evidence');
  }
  if (bool(input.wrongOwner)) reasons.push('plan_reviewer_wrong_owner');
  if (bool(input.missingCutover)) reasons.push('plan_reviewer_missing_cutover');
  if (bool(input.weakEvidence)) reasons.push('plan_reviewer_weak_evidence');
  return reasons.length ? fail('planReviewerWorkerStatus', reasons) : pass('planReviewerWorkerStatus', { planAlignmentStatus: input.planAlignmentStatus || 'aligned' });
}

export function buildAntiAccretionReport(input = {}) {
  const reasons = [];
  if (bool(input.dualActivePath)) reasons.push('anti_accretion_dual_active_path');
  if (!input.disposition) reasons.push('old_path_disposition_missing');
  return reasons.length ? fail('antiAccretionStatus', reasons) : pass('antiAccretionStatus', { disposition: input.disposition });
}

export function buildVisibleAcceptanceEvidenceReport(input = {}) {
  const reasons = [];
  for (const key of ['beforeUserVisibleBehavior', 'afterUserVisibleBehavior', 'whatUserSaw', 'whatUserReceived', 'whatUserCouldDo', 'evidenceType', 'evidenceLocation', 'limitations']) {
    if (!input[key]) reasons.push('visible_acceptance_evidence_missing');
  }
  if (String(input.evidenceType || '') === 'unit_test' && bool(input.productBehaviorChange)) reasons.push('visible_acceptance_evidence_test_only');
  if (bool(input.fixtureAsRuntime) || bool(input.localSmokeAsProduction)) reasons.push('visible_acceptance_evidence_missing');
  return reasons.length ? fail('visibleAcceptanceEvidenceStatus', reasons) : pass('visibleAcceptanceEvidenceStatus', { evidenceType: input.evidenceType });
}

export function buildToolchainAvailabilityReport(input = {}) {
  const nodeOk = input.nodeOk ?? commandOk('node');
  const npmOk = input.npmOk ?? commandOk('npm');
  const ghOk = input.ghOk ?? commandOk('gh');
  const reasons = [];
  if (!nodeOk) reasons.push('toolchain_node_missing');
  if (!npmOk) reasons.push('toolchain_npm_missing');
  if (!ghOk) reasons.push('toolchain_gh_missing');
  return reasons.length ? fail('toolchainAvailabilityStatus', reasons) : pass('toolchainAvailabilityStatus');
}

export function buildNodeAvailabilityReport(input = {}) {
  return (input.nodeOk ?? commandOk('node')) ? pass('nodeAvailabilityStatus') : fail('nodeAvailabilityStatus', ['toolchain_node_missing']);
}

export function buildNpmAvailabilityReport(input = {}) {
  return (input.npmOk ?? commandOk('npm')) ? pass('npmAvailabilityStatus') : fail('npmAvailabilityStatus', ['toolchain_npm_missing']);
}

export function buildGithubCliAvailabilityReport(input = {}) {
  return (input.ghOk ?? commandOk('gh')) ? pass('githubCliAvailabilityStatus') : fail('githubCliAvailabilityStatus', ['toolchain_gh_missing']);
}

export function buildGithubAuthReport(input = {}) {
  const tokenPresent = Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || input.tokenPresent);
  const authOk = input.authOk ?? (tokenPresent || commandOk('gh', ['auth', 'status']));
  return authOk ? pass('githubAuthStatus') : fail('githubAuthStatus', ['github_auth_missing']);
}

export function buildShellPathProfileReport(input = {}) {
  return bool(input.pathUnstable) ? fail('shellPathProfileStatus', ['toolchain_node_missing']) : pass('shellPathProfileStatus');
}

export function buildParentHarnessPreflightReport(input = {}) {
  const reasons = [];
  if (String(input.parentVersion || '1.0.0') !== '1.0.0') reasons.push('parent_harness_preflight_failed');
  if (bool(input.v100SelfTestFail)) reasons.push('parent_harness_preflight_failed');
  if (bool(input.sameHeadRemoteQualityGateMissing)) reasons.push('same_head_main_quality_gate_missing');
  return reasons.length ? fail('parentHarnessPreflightStatus', reasons) : pass('parentHarnessPreflightStatus', { degradedLane: bool(input.parentKnownDefectLane) });
}

export function buildHarnessSourceGatePreconditionReport(input = {}) {
  return any(input, ['headMismatch', 'worktreeDirty', 'markerMissing', 'secretScanFail', 'v100SelfTestFail'])
    ? fail('harnessSourceGatePreconditionStatus', ['parent_harness_preflight_failed'])
    : pass('harnessSourceGatePreconditionStatus', { degradedLane: bool(input.parentKnownDefectLane) });
}

export function buildLocalBranchInvariantReport(input = {}) {
  if (!bool(input.pilotRelevant)) return pass('localBranchInvariantStatus', { context: input.context || 'source_core' });
  return String(input.branch || '') === 'main' ? pass('localBranchInvariantStatus') : fail('localBranchInvariantStatus', ['local_branch_not_main']);
}

export function buildTargetHeadInvariantReport(input = {}) {
  if (!bool(input.pilotRelevant)) return pass('targetHeadInvariantStatus', { context: input.context || 'source_core' });
  return input.head && input.originMain && input.head === input.originMain ? pass('targetHeadInvariantStatus') : fail('targetHeadInvariantStatus', ['head_not_origin_main']);
}

export function buildOriginMainDriftReport(input = {}) {
  return bool(input.originMainDrifted) && !bool(input.sameHeadMainQualityGateSuccess)
    ? fail('originMainDriftStatus', ['origin_main_drift_without_same_head_quality_gate'])
    : pass('originMainDriftStatus');
}

export function buildSameHeadMainQualityGateReport(input = {}) {
  if (!bool(input.required)) return pass('sameHeadMainQualityGateStatus', { context: input.context || 'source_core' });
  return bool(input.sameHeadMainQualityGateSuccess) ? pass('sameHeadMainQualityGateStatus') : fail('sameHeadMainQualityGateStatus', ['same_head_main_quality_gate_missing']);
}

export function buildLocalTargetGateBoundedReport(input = {}) {
  return bool(input.unbounded) ? fail('localTargetGateBoundedStatus', ['local_target_gate_unbounded']) : pass('localTargetGateBoundedStatus');
}

export function buildLocalGateReportContractReport(input = {}) {
  const reasons = [];
  if (bool(input.timeout)) reasons.push('local_gate_timeout');
  if (Number(input.stdoutBytes ?? 1) === 0 && !input.reportPath) reasons.push('local_gate_json_missing');
  if (bool(input.emptyJson)) reasons.push('local_gate_json_empty');
  if (bool(input.reportPathMissing)) reasons.push('local_gate_report_path_missing');
  if (bool(input.unknownContract)) reasons.push('local_gate_unknown_report_contract');
  if (bool(input.stdoutStderrEmptyTimeout)) reasons.push('local_gate_stdout_stderr_empty_timeout');
  return reasons.length ? fail('localGateReportContractStatus', reasons) : pass('localGateReportContractStatus', { output: input.reportPath ? 'report_path' : 'stdout' });
}

export function buildJsonReportShapeReport(input = {}) {
  const reasons = [];
  if (bool(input.missing)) reasons.push('local_gate_json_missing');
  if (bool(input.empty)) reasons.push('local_gate_json_empty');
  if (bool(input.parseFailed)) reasons.push('local_gate_json_parse_failed');
  if (bool(input.humanTextMixed)) reasons.push('local_gate_human_text_mixed_with_json');
  return reasons.length ? fail('jsonReportShapeStatus', reasons) : pass('jsonReportShapeStatus');
}

export function buildLocalGateSideEffectReport(input = {}) {
  const reasons = [];
  if (bool(input.trackedFileSideEffect) || (input.before?.statusShort || '') !== (input.after?.statusShort || '')) reasons.push('local_gate_tracked_file_side_effect');
  if (bool(input.branchMutation) || (input.before?.branch || '') !== (input.after?.branch || '')) reasons.push('local_gate_branch_mutation');
  if (bool(input.headMutation) || (input.before?.head || '') !== (input.after?.head || '')) reasons.push('local_gate_head_mutation');
  if (bool(input.trackedGeneratedArtifact)) reasons.push('tracked_generated_artifact_created');
  return reasons.length ? fail('localGateSideEffectStatus', reasons) : pass('localGateSideEffectStatus');
}

export function buildPilotInputCleanlinessReport(input = {}) {
  const reasons = [];
  if (bool(input.dirty)) reasons.push('pilot_input_dirty');
  if (bool(input.wrongBranch)) reasons.push('local_branch_not_main');
  if (bool(input.headMismatch)) reasons.push('head_not_origin_main');
  if (bool(input.trackedGeneratedArtifact)) reasons.push('tracked_generated_artifact_created');
  return reasons.length ? fail('pilotInputCleanlinessStatus', reasons) : pass('pilotInputCleanlinessStatus');
}

export function buildTrackedGeneratedArtifactReport(input = {}) {
  return bool(input.trackedGeneratedArtifact) ? fail('trackedGeneratedArtifactStatus', ['tracked_generated_artifact_created']) : pass('trackedGeneratedArtifactStatus');
}

export function buildCurrentHeadEvidenceReport(input = {}) {
  const required = ['repo', 'branch', 'headSha', 'originMainSha', 'sameHeadMainQualityGateStatus', 'worktreeClean', 'aheadBehind', 'toolchainOk', 'ghAuthOk', 'targetHarnessVersion', 'sourceHarnessVersion'];
  const missing = required.filter((key) => input[key] === undefined || input[key] === '');
  return missing.length ? fail('currentHeadEvidenceField', ['missing_head_sha'], { missing }) : pass('currentHeadEvidenceField');
}

export function buildHarnessOnlyDriftClassificationReport(input = {}) {
  return any(input, ['productCodeChanged', 'mixedHarnessAndProduct', 'unknownDrift'])
    ? fail('harnessOnlyDriftClassificationStatus', ['scope_mismatch'])
    : pass('harnessOnlyDriftClassificationStatus');
}

export function buildSmallProductPrFastPathReport(input = {}) {
  const reasons = [];
  if (Number(input.changedFiles ?? 1) > 3) reasons.push('small_product_pr_fast_path_ineligible');
  if (any(input, ['schemaChange', 'runtimeReadinessClaimed', 'productionReadinessClaimed', 'noRemoteEvidence'])) reasons.push('small_product_pr_fast_path_ineligible');
  return reasons.length ? fail('smallProductPrFastPathStatus', reasons) : pass('smallProductPrFastPathStatus');
}

export function buildSelfTestFixtureIsolationReport(input = {}) {
  return any(input, ['remoteEnvLeak', 'trackedFileSideEffect', 'runtimeReadinessClaimed', 'productionReadinessClaimed'])
    ? fail('selfTestFixtureIsolationStatus', ['self_test_fixture_isolation_failed'])
    : pass('selfTestFixtureIsolationStatus');
}

export function buildAuthoritativeProductEvidenceReport(input = {}) {
  const reasons = [];
  if (bool(input.sameHeadFormalFail)) reasons.push('authoritative_product_evidence_conflict');
  if (bool(input.placeholderOnly) || bool(input.lifeboatOnly) || bool(input.workflowDispatchAsPrEvidence) || bool(input.sameHeadMismatch)) reasons.push('authoritative_product_evidence_conflict');
  return reasons.length ? fail('authoritativeProductEvidenceStatus', reasons) : pass('authoritativeProductEvidenceStatus');
}

export function buildTargetQualityOwnerActionReport(input = {}) {
  const allowed = ['product_fix_required', 'body_only_required', 'harness_fix_required', 'remote_infra_required', 'manual_confirmation_required'];
  const actions = Array.isArray(input.actions) ? input.actions : [input.action || 'product_fix_required'];
  const valid = actions.filter((action) => allowed.includes(action));
  return valid.length === 1 && actions.length === 1
    ? pass('targetQualityOwnerActionStatus', { action: valid[0] })
    : fail('targetQualityOwnerActionStatus', ['target_quality_owner_action_ambiguous']);
}

export function buildRuntimeAdoptionSequenceReport(input = {}) {
  const order = ['foundation', 'claim', 'persistence', 'reconciliation', 'worker', 'runtime_readiness', 'production_go'];
  const steps = input.steps || order;
  const indexes = steps.map((step) => order.indexOf(step));
  const outOfOrder = indexes.some((value, index) => value < 0 || (index > 0 && value < indexes[index - 1]));
  if (outOfOrder || bool(input.runtimeReadinessBeforeEvidence) || bool(input.productionGoBeforeOracle)) {
    return fail('runtimeAdoptionSequenceStatus', ['runtime_adoption_sequence_violation']);
  }
  return pass('runtimeAdoptionSequenceStatus');
}

export function buildV101SelfTestRegistrationReport(input = {}) {
  const reasons = [];
  if (!fs.existsSync('scripts/codex-v101-self-test.mjs') || bool(input.selfTestMissing)) reasons.push('v101_self_test_missing');
  if (!readText('scripts/codex-local-quality-gate.mjs')?.includes('v101SelfTestStatus')) reasons.push('v101_self_test_missing');
  if (!readText('CODEX_SOURCE_HARNESS_MANIFEST.json')?.includes('codex-v101-self-test.mjs')) reasons.push('v101_self_test_missing');
  return reasons.length ? fail('v101SelfTestStatus', reasons) : pass('v101SelfTestStatus');
}

export function buildDefaultV101Reports(context = {}) {
  const before = context.beforeSnapshot || {};
  const after = context.afterSnapshot || before;
  return {
    primeDirectiveStatus: buildPrimeDirectiveReport(),
    outcomeContractStatus: buildOutcomeContractReport(),
    sourceOfTruthOwnershipStatus: buildSourceOfTruthOwnershipReport({
      ownerModule: 'source_harness',
      ownerFileOrPackage: 'scripts/codex-v101-gate-lib.mjs',
      publicContract: 'CODEX_QUALITY_REPORT=json returns parseable safe JSON',
      downstreamConsumers: ['codex-local-quality-gate.mjs'],
      forbiddenDuplicateOwners: ['target repos'],
    }),
    oldPathDispositionStatus: buildOldPathDispositionReport({ disposition: 'redirect' }),
    planReviewerWorkerStatus: buildPlanReviewerWorkerReport({ reviewers: ['owner_reviewer', 'cutover_reviewer', 'evidence_reviewer'] }),
    antiAccretionStatus: buildAntiAccretionReport({ disposition: 'redirect' }),
    visibleAcceptanceEvidenceStatus: buildVisibleAcceptanceEvidenceReport({
      productBehaviorChange: false,
      beforeUserVisibleBehavior: 'v1.0.0 parent local gate can fail without JSON',
      afterUserVisibleBehavior: 'v1.0.1 local gate returns safe JSON status',
      whatUserSaw: 'parseable quality report',
      whatUserReceived: 'machine-readable reason codes',
      whatUserCouldDo: 'continue source validation without raw logs',
      evidenceType: 'operator_visible_delta',
      evidenceLocation: 'local gate JSON report',
      limitations: 'not runtime readiness or production readiness evidence',
    }),
    toolchainAvailabilityStatus: buildToolchainAvailabilityReport(context.toolchain || {}),
    nodeAvailabilityStatus: buildNodeAvailabilityReport(context.toolchain || {}),
    npmAvailabilityStatus: buildNpmAvailabilityReport(context.toolchain || {}),
    githubCliAvailabilityStatus: buildGithubCliAvailabilityReport(context.toolchain || {}),
    githubAuthStatus: buildGithubAuthReport(context.toolchain || {}),
    shellPathProfileStatus: buildShellPathProfileReport(context.toolchain || {}),
    parentHarnessPreflightStatus: buildParentHarnessPreflightReport({ parentKnownDefectLane: true }),
    harnessSourceGatePreconditionStatus: buildHarnessSourceGatePreconditionReport({ parentKnownDefectLane: true }),
    localBranchInvariantStatus: buildLocalBranchInvariantReport({ context: 'source_core' }),
    targetHeadInvariantStatus: buildTargetHeadInvariantReport({ context: 'source_core' }),
    originMainDriftStatus: buildOriginMainDriftReport({ sameHeadMainQualityGateSuccess: true }),
    sameHeadMainQualityGateStatus: buildSameHeadMainQualityGateReport({ context: 'source_core' }),
    localTargetGateBoundedStatus: buildLocalTargetGateBoundedReport(),
    localGateReportContractStatus: buildLocalGateReportContractReport(),
    jsonReportShapeStatus: buildJsonReportShapeReport(),
    localGateSideEffectStatus: buildLocalGateSideEffectReport({ before, after }),
    pilotInputCleanlinessStatus: buildPilotInputCleanlinessReport(),
    trackedGeneratedArtifactStatus: buildTrackedGeneratedArtifactReport(),
    currentHeadEvidenceField: buildCurrentHeadEvidenceReport({
      repo: context.repo || 'source_harness',
      branch: context.branch || after.branch || 'unknown',
      headSha: context.headSha || after.head || 'unknown',
      originMainSha: context.originMainSha || context.headSha || after.head || 'unknown',
      sameHeadMainQualityGateStatus: 'pass',
      worktreeClean: true,
      aheadBehind: context.aheadBehind || 'source_core',
      toolchainOk: true,
      ghAuthOk: true,
      targetHarnessVersion: 'not_applicable',
      sourceHarnessVersion: '1.0.1',
    }),
    harnessOnlyDriftClassificationStatus: buildHarnessOnlyDriftClassificationReport(),
    smallProductPrFastPathStatus: buildSmallProductPrFastPathReport(),
    selfTestFixtureIsolationStatus: buildSelfTestFixtureIsolationReport(),
    authoritativeProductEvidenceStatus: buildAuthoritativeProductEvidenceReport(),
    targetQualityOwnerActionStatus: buildTargetQualityOwnerActionReport({ action: 'harness_fix_required' }),
    runtimeAdoptionSequenceStatus: buildRuntimeAdoptionSequenceReport(),
    v101SelfTestStatus: buildV101SelfTestRegistrationReport(),
  };
}

export function runV101GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder();
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
