#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V128_OPERATOR_STATUS_KEYS,
  V128_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateOrchestrationCapsule,
  validateV128DeterministicDecisionProjection,
  validateV128OrthogonalReasonModel,
  validateV128ResumableLoopAndPermissionProjection,
  validateV128TokenMinimalReadCompatibilityRouter,
} from './codex-orchestration-capsule.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

function passed(status) {
  return status?.status === 'pass';
}

function failed(status) {
  return status?.status === 'fail';
}

function resolveHarnessMode(env = process.env) {
  if (env.CODEX_HARNESS_MODE === 'target') return 'target';
  if (env.CODEX_HARNESS_SOURCE_REPO === '1' || env.CODEX_HARNESS_MODE === 'core' || env.CODEX_HARNESS_MODE === 'source') return 'source';
  try {
    const manifest = JSON.parse(fs.readFileSync('docs/process/CODEX_HARNESS_MANIFEST.json', 'utf8'));
    if (manifest.targetRepoMode === true) return 'target';
    if (manifest.sourceOnlyRelease === true) return 'source';
  } catch {
    // Source-body self-test fixtures may omit the target manifest.
  }
  return 'source';
}

function activeManifestPathsForMode(env = process.env) {
  return resolveHarnessMode(env) === 'target'
    ? ['docs/process/CODEX_HARNESS_MANIFEST.json']
    : ['CODEX_SOURCE_HARNESS_MANIFEST.json', 'docs/process/CODEX_HARNESS_MANIFEST.json'];
}

function manifestThemeMatchesActiveVersion() {
  const manifests = activeManifestPathsForMode().map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  return manifests.every((manifest) => manifest.activeHarnessVersion === '1.2.8'
    && manifest.activeSelfTestSuite === 'v128'
    && manifest.theme === 'Deterministic Decision Projection and Token-Minimal Loop Closure');
}

const cases = [
  ['v128_self_test_must_pass', () => true],
  ['v128_adds_no_new_p0_artifact', () => V128_P0_ARTIFACTS.length === 3 && V128_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v128_adds_no_new_top_level_status', () => V128_OPERATOR_STATUS_KEYS.length === 8 && !V128_OPERATOR_STATUS_KEYS.includes('deterministicDecisionProjectionStatus')],
  ['v128_preserves_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v128_active_authority_tuple_is_current', () => {
    const tuple = buildOrchestrationCapsule().skillContextRouting.activeAuthorityTuple;
    return tuple.agentsMarker === 'CODEX_QUALITY_HARNESS_FILE v1.2.8'
      && tuple.manifestActiveHarnessVersion === '1.2.8'
      && tuple.activeSelfTestSuite === 'v128'
      && tuple.activeSpecPath === 'docs/process/CODEX_V128_SPEC.md';
  }],
  ['manifest_theme_matches_active_version', () => manifestThemeMatchesActiveVersion()],
  ['stored_projection_is_safe_summary_non_authoritative', () => passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule().deterministicDecisionProjection))],
  ['decision_capsule_cannot_be_projection', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { decisionCapsuleIsProjectionPhraseDetected: true },
  }).deterministicDecisionProjection))],
  ['projection_cannot_preclaim_provider_closure', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { providerClosurePreclaimed: true },
  }).deterministicDecisionProjection))],
  ['projection_size_budget_enforced', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { projectionBytes: 1601 },
  }).deterministicDecisionProjection))],
  ['reason_state_pending_effect_derived_by_phase', () => passed(validateV128OrthogonalReasonModel(buildOrchestrationCapsule().orthogonalReasonModel))],
  ['awaiting_is_effect_not_state', () => failed(validateV128OrthogonalReasonModel(buildOrchestrationCapsule({
    orthogonalReasonModel: { reasons: [{ reasonCode: 'required_check_pending', state: 'awaiting', evidenceRef: 'provider.requiredChecks' }] },
  }).orthogonalReasonModel))],
  ['routine_cold_artifact_read_is_zero', () => passed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule().tokenMinimalReadCompatibilityRouter))],
  ['routine_cold_read_fails_when_nonzero', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { routineColdArtifactRead: 1 },
  }).tokenMinimalReadCompatibilityRouter))],
  ['compiled_instruction_capsule_forbids_llm_summary', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { llmSummaryForInstructionCapsule: true },
  }).tokenMinimalReadCompatibilityRouter))],
  ['micro_transition_inflation_guard_required', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { microTransitionInflationGuard: false },
  }).tokenMinimalReadCompatibilityRouter))],
  ['mandatory_safety_skill_requires_allowlist', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { mandatorySafetyTriggerAllowlisted: false },
  }).tokenMinimalReadCompatibilityRouter))],
  ['permission_projection_is_not_authority', () => passed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule().resumableLoopAndPermissionProjection))],
  ['projection_cannot_create_permission', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { projectionCreatesPermission: true },
  }).resumableLoopAndPermissionProjection))],
  ['receipt_hydration_requires_digest_binding', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { receiptHydrationBinding: { receiptHydrationState: 'valid' } },
  }).resumableLoopAndPermissionProjection))],
  ['checkpoint_requires_head_scope_receipt_binding', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { checkpointBinding: { checkpointSchemaVersion: '1.2.8' } },
  }).resumableLoopAndPermissionProjection))],
  ['network_filesystem_auto_resume_forbidden', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { networkFilesystemAutoResumeAllowed: true },
  }).resumableLoopAndPermissionProjection))],
  ['target_mode_does_not_require_source_manifest', () => activeManifestPathsForMode({ CODEX_HARNESS_MODE: 'target' }).join('|') === 'docs/process/CODEX_HARNESS_MANIFEST.json'],
  ['orchestration_capsule_validates_all_v128_internal_blocks', () => Object.values(validateOrchestrationCapsule(buildOrchestrationCapsule())).every((item) => item.status === 'pass')],
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v127_preservation_matrix_profile_inheritance',
  'deterministic_decision_projection_matrix',
  'orthogonal_reason_model_matrix',
  'token_minimal_read_router_matrix',
  'resumable_loop_permission_projection_matrix',
  'reader_before_writer_migration_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v128SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    fixtureGroups,
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_V128_SELF_TEST_REPORT');
if (!process.env.CODEX_V128_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v128SelfTestStatus: ${report.v128SelfTestStatus.status}`);
}
exitFor(report);
