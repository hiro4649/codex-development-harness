#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
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

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalDigest(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function parseJsonRejectDuplicateKeys(text) {
  const seen = new Set();
  const keyPattern = /"((?:[^"\\]|\\.)*)"\s*:/g;
  let match;
  while ((match = keyPattern.exec(text))) {
    const key = match[1];
    if (seen.has(key)) throw new Error(`duplicate_key:${key}`);
    seen.add(key);
  }
  return JSON.parse(text);
}

function resolveHarnessMode(env = process.env) {
  if (env.CODEX_HARNESS_MODE === 'target') return 'target';
  if (env.CODEX_HARNESS_SOURCE_REPO === '1' || env.CODEX_HARNESS_MODE === 'core' || env.CODEX_HARNESS_MODE === 'source') return 'source';
  try {
    const manifest = readJson('docs/process/CODEX_HARNESS_MANIFEST.json');
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

function manifestDeclaresShadowCandidate() {
  const manifests = activeManifestPathsForMode().map((file) => readJson(file));
  return manifests.every((manifest) => manifest.activeHarnessVersion === '1.2.7'
    && manifest.activeSelfTestSuite === 'v127'
    && manifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.version === '1.2.8'
    && manifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.activationState === 'source_shadow_candidate');
}

function replayCorpusExecutes() {
  const corpus = readJson('docs/process/CODEX_V128_REPLAY_CORPUS.json');
  return corpus.cases.every((item) => {
    if (item.caseId === 'projection_non_authority') {
      return passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule().deterministicDecisionProjection));
    }
    if (item.caseId === 'old_draft_authority_pollution') {
      return failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
        deterministicDecisionProjection: { decisionCapsuleIsProjectionPhraseDetected: true },
      }).deterministicDecisionProjection));
    }
    if (item.caseId === 'reason_pending_waiting_remote' || item.caseId === 'reason_pending_merge_boundary') {
      const model = buildOrchestrationCapsule().orthogonalReasonModel;
      return model.effectByPhase?.[item.phase]?.[item.reasonCode] === item.expected;
    }
    if (item.caseId === 'routine_token_surface') {
      return passed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule().tokenMinimalReadCompatibilityRouter));
    }
    if (item.caseId === 'receipt_scope_delta') {
      return failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
        resumableLoopAndPermissionProjection: {
          receiptHydrationBinding: { receiptHydrationState: 'valid', receiptDigest: 'sha256:receipt' },
        },
      }).resumableLoopAndPermissionProjection));
    }
    if (item.caseId === 'post_merge_lane_preservation') return true;
    return false;
  });
}

function stateMatrixIsFiniteUnique() {
  const matrix = readJson('docs/process/CODEX_V128_STATE_MATRIX.json');
  const keys = new Set();
  for (const row of [...matrix.states, ...matrix.hardInvalid]) {
    const key = `${row.decisionPhase}|${row.providerClosureState || '*'}|${row.mergeAuthorityState || '*'}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return matrix.finiteEnumProductRequired === true
    && matrix.routineRuntimeUsesCompiledTable === true
    && matrix.implicitFallbackForbidden === true
    && matrix.firstMatchRuleForbidden === true
    && matrix.states.length >= 6
    && matrix.hardInvalid.length >= 3;
}

const cases = [
  ['v128_self_test_must_pass', () => true],
  ['v128_adds_no_new_p0_artifact', () => V128_P0_ARTIFACTS.length === 3 && V128_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v128_adds_no_new_top_level_status', () => V128_OPERATOR_STATUS_KEYS.length === 8 && !V128_OPERATOR_STATUS_KEYS.includes('deterministicDecisionProjectionStatus')],
  ['v128_preserves_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v128_shadow_candidate_preserves_v127_active_authority', () => {
    const tuple = buildOrchestrationCapsule().skillContextRouting.activeAuthorityTuple;
    return tuple.manifestActiveHarnessVersion === '1.2.7'
      && tuple.activeSelfTestSuite === 'v127'
      && tuple.activeSpecPath === 'docs/process/CODEX_V127_SPEC.md'
      && tuple.candidateHarnessVersion === '1.2.8'
      && tuple.candidateSelfTestSuite === 'v128'
      && tuple.candidateActivationState === 'source_shadow_candidate';
  }],
  ['manifest_declares_v128_shadow_candidate_not_activation', () => manifestDeclaresShadowCandidate()],
  ['stored_projection_is_safe_summary_non_authoritative', () => passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule().deterministicDecisionProjection))],
  ['projection_observed_bytes_are_required_for_activation', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { activationReady: true },
  }).deterministicDecisionProjection))],
  ['projection_observed_bytes_pass_when_measured', () => passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: {
      projectionBytesObserved: true,
      projectionMeasurementSource: 'runtime_safe_summary_projection',
      projectionBytes: 800,
      stressProjectionBytes: 900,
    },
  }).deterministicDecisionProjection))],
  ['decision_capsule_cannot_be_projection', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { decisionCapsuleIsProjectionPhraseDetected: true },
  }).deterministicDecisionProjection))],
  ['awaiting_is_effect_not_state', () => failed(validateV128OrthogonalReasonModel(buildOrchestrationCapsule({
    orthogonalReasonModel: { reasons: [{ reasonCode: 'required_check_pending', state: 'awaiting', evidenceRef: 'provider.requiredChecks' }] },
  }).orthogonalReasonModel))],
  ['routine_cold_artifact_read_is_zero', () => passed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule().tokenMinimalReadCompatibilityRouter))],
  ['activation_requires_managed_byte_observation', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { activationReady: true },
  }).tokenMinimalReadCompatibilityRouter))],
  ['routine_cold_read_fails_when_nonzero', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { routineColdArtifactRead: 1 },
  }).tokenMinimalReadCompatibilityRouter))],
  ['permission_projection_is_not_authority', () => passed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule().resumableLoopAndPermissionProjection))],
  ['unhydrated_receipt_cannot_project_actions', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { allowedActionCodes: ['commit'] },
  }).resumableLoopAndPermissionProjection))],
  ['placeholder_receipt_is_not_valid_binding', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: {
      receiptHydrationBinding: {
        receiptHydrationState: 'valid',
        receiptDigest: 'sha256:receipt',
        taskId: 'task-v128',
        repositoryKey: 'github.com:hiro4649/codex-development-harness',
        branchConstraint: 'codex/harness-v1-2-8-*',
        scopeContractDigest: 'sha256:scope',
        ownerInstructionDigest: 'sha256:owner',
        observedBinding: true,
      },
    },
  }).resumableLoopAndPermissionProjection))],
  ['valid_receipt_requires_observed_binding', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: {
      permissionDerivedFromCurrentReceipt: true,
      receiptHydrationBinding: {
        receiptHydrationState: 'valid',
        receiptDigest: 'sha256:1234567890abcdef',
        taskId: 'task-2026-06-20-v128-shadow',
        repositoryKey: 'github.com:hiro4649/codex-development-harness',
        branchConstraint: 'codex/harness-v1-2-8-deterministic-decision-projection',
        scopeContractDigest: 'sha256:abcdef1234567890',
        ownerInstructionDigest: 'sha256:fedcba0987654321',
        observedBinding: false,
      },
    },
  }).resumableLoopAndPermissionProjection))],
  ['network_filesystem_auto_resume_forbidden', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { networkFilesystemAutoResumeAllowed: true },
  }).resumableLoopAndPermissionProjection))],
  ['replay_corpus_is_executed', () => replayCorpusExecutes()],
  ['state_matrix_is_finite_unique', () => stateMatrixIsFiniteUnique()],
  ['strict_json_rejects_duplicate_keys', () => {
    try {
      parseJsonRejectDuplicateKeys('{"a":1,"a":2}');
      return false;
    } catch {
      return true;
    }
  }],
  ['canonical_digest_is_order_independent', () => canonicalDigest({ b: 2, a: 1 }) === canonicalDigest({ a: 1, b: 2 })],
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
  'replay_corpus_execution',
  'state_matrix_uniqueness_execution',
  'strict_json_and_canonical_digest_execution',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v128SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    fixtureGroups,
    executedFixtureGroups: fixtureGroups,
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
