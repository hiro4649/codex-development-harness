#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V112_STATUS_KEYS,
  SAFETY_PROFILES,
  buildDefaultV112Statuses,
  buildCommandOutputPolicy,
  buildRolloutStateCapsule,
  buildRepoRolloutManifest,
  buildArtifactPointer,
  pickSafeSummary,
  comparePrecision,
  buildV112Report,
} from './codex-v112-conversation-surface.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const defaultStatuses = buildDefaultV112Statuses();
const policy = buildCommandOutputPolicy();
const capsule = buildRolloutStateCapsule();
const manifest = buildRepoRolloutManifest();
const fullDecision = {
  hardBlocker: 'blocked',
  allowedNow: 'preserve_dirty_state',
  forbiddenNow: 'product_repair',
  oneSafeNextAction: 'develop_source_harness_v112',
  mergeAllowed: false,
  productRepairAllowed: false,
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  rawLogsAllowed: false,
  sameHeadRequiredCheckStatus: 'fail',
  productCodeFailure: true,
};
const compactDecision = { ...fullDecision };

const cases = [
  test('all_v112_status_keys_default_pass', () => V112_STATUS_KEYS.every((key) => defaultStatuses[key]?.status === 'pass')),
  test('v112_report_passes', () => buildV112Report().status === 'pass'),
  test('v112_self_status_present', () => buildV112Report().v112SelfTestStatus.status === 'pass'),
  test('quality_gate_file_only_policy', () => policy.qualityGate === 'file_only'),
  test('no_tee_full_json_policy', () => defaultStatuses.noTeeFullJsonStatus.status === 'pass'),
  test('large_json_console_suppression_default', () => defaultStatuses.largeJsonConsoleSuppressionStatus.status === 'pass'),
  test('console_silence_by_default', () => defaultStatuses.consoleSilenceByDefaultStatus.status === 'pass'),
  test('safe_summary_top_n_default_three', () => pickSafeSummary({ failures: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }).topBlockingReasonCodes.length === 3),
  test('safe_summary_counts_passes_not_lists', () => pickSafeSummary({ a: { status: 'pass' }, b: { status: 'pass' } }).passStatusCount === 2 && pickSafeSummary({}).passStatusesListed === false),
  test('safe_summary_includes_required_fields', () => ['status', 'qualityScore', 'requiredCheckStatus', 'topBlockingReasonCodes', 'topManualReasonCodes', 'productCodeChanged', 'runtimeReadinessClaimed', 'productionReadinessClaimed', 'safeArtifactPath'].every((key) => Object.hasOwn(pickSafeSummary({}), key))),
  test('safe_summary_product_flag_preserved', () => pickSafeSummary({ changeClassificationStatus: { classification: { productSourceChanged: true } } }).productCodeChanged === true),
  test('safe_summary_runtime_flag_preserved', () => pickSafeSummary({ changeClassificationStatus: { classification: { runtimeReadinessClaimed: true } } }).runtimeReadinessClaimed === true),
  test('safe_summary_production_flag_preserved', () => pickSafeSummary({ productionReadinessStatus: { productionReadinessClaimed: true } }).productionReadinessClaimed === true),
  test('artifact_pointer_has_sha', () => {
    const tmp = path.join(os.tmpdir(), 'codex-v112-artifact-pointer.safe.json');
    fs.writeFileSync(tmp, '{"safeSummaryOnly":true}', 'utf8');
    return /^[a-f0-9]{64}$/.test(buildArtifactPointer(tmp).sha256);
  }),
  test('artifact_pointer_does_not_expand_raw', () => buildArtifactPointer().rawExpandedArtifact === false),
  test('rollout_capsule_partial_v111_state', () => capsule.activeHarness === 'v1.1.1' && capsule.nextHarness === 'v1.1.2' && capsule.blockedTarget === 'FUNKY'),
  test('rollout_capsule_no_raw_logs', () => capsule.rawLogsRead === false),
  test('rollout_capsule_no_8_session', () => capsule.eightSessionUsed === false),
  test('repo_manifest_order', () => manifest.order.join(',') === 'VOXWEAVE,IRIS-live2d-renderer,FUNKY,IRIS,CRIPTO-TIP'),
  test('repo_manifest_profiles_present', () => Object.keys(manifest.profiles).length === 5),
  test('all_required_profiles_present', () => ['v112_target_harness_no_runtime_no_product', 'v112_voxweave_no_tts_asr_runtime', 'v112_live2d_no_renderer_runtime_no_loader', 'v112_funky_no_tx_no_runtime', 'v112_iris_priority1_blocked_no_runtime', 'v112_cripto_no_crypto_youtube_runtime'].every((key) => SAFETY_PROFILES[key])),
  test('command_policy_git_status_full', () => policy.gitStatus === 'full_allowed'),
  test('command_policy_git_diff_stat_cap', () => policy.gitDiffStat.maxLines === 40),
  test('command_policy_rg_cap', () => policy.rg.maxMatches === 50),
  test('command_policy_get_content_line_range_only', () => policy.getContent === 'line_range_only'),
  test('github_pr_field_budget', () => policy.ghPrView.fields.join(',') === 'number,state,headRefOid,baseRefName,url,statusCheckRollup'),
  test('github_run_field_budget', () => policy.ghRunView.fields.join(',') === 'databaseId,headSha,status,conclusion,workflowName,url'),
  test('github_jobs_default_denied', () => policy.ghRunJobs.includes('denied')),
  test('precision_parity_passes_equal_decisions', () => comparePrecision(fullDecision, compactDecision).status === 'pass'),
  test('precision_parity_blocks_hard_blocker_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, hardBlocker: 'none' }).status === 'fail'),
  test('precision_parity_blocks_allowed_now_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, allowedNow: 'merge' }).status === 'fail'),
  test('precision_parity_blocks_forbidden_now_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, forbiddenNow: 'none' }).status === 'fail'),
  test('precision_parity_blocks_next_action_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, oneSafeNextAction: 'repair_product' }).status === 'fail'),
  test('precision_parity_blocks_merge_allowed_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, mergeAllowed: true }).status === 'fail'),
  test('precision_parity_blocks_product_repair_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, productRepairAllowed: true }).status === 'fail'),
  test('precision_parity_blocks_runtime_readiness_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, runtimeReadinessClaimed: true }).status === 'fail'),
  test('precision_parity_blocks_production_readiness_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, productionReadinessClaimed: true }).status === 'fail'),
  test('precision_parity_blocks_raw_logs_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, rawLogsAllowed: true }).status === 'fail'),
  test('precision_parity_blocks_same_head_check_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, sameHeadRequiredCheckStatus: 'pass' }).status === 'fail'),
  test('precision_parity_blocks_product_code_failure_mismatch', () => comparePrecision(fullDecision, { ...compactDecision, productCodeFailure: false }).status === 'fail'),
  test('evidence_fidelity_preserved', () => buildV112Report().evidenceFidelityPreservationStatus.machineDecisionSource === 'compact_json'),
  test('conversation_surface_reduced', () => buildV112Report().conversationSurfaceReductionStatus.fullJsonStdoutDefault === false),
  test('target_rollout_not_started', () => buildV112Report().targetRollout === 'not_started'),
  test('target_repos_not_touched', () => buildV112Report().targetReposTouched === false),
  test('product_code_not_changed', () => buildV112Report().productCodeChanged === false),
  test('runtime_readiness_not_claimed', () => buildV112Report().runtimeReadinessClaimed === false),
  test('production_readiness_not_claimed', () => buildV112Report().productionReadinessClaimed === false),
  test('raw_logs_not_read', () => buildV112Report().rawLogsRead === false),
  test('eight_session_not_used', () => buildV112Report().eightSessionUsed === false),
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v112SelfTestStatus: { status: failures.length ? 'fail' : 'pass', caseCount: cases.length, failureCount: failures.length, safeSummaryOnly: true },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_V112_SELF_TEST_REPORT');
if (!process.env.CODEX_V112_SELF_TEST_REPORT) console.log(`v112SelfTestStatus: ${report.v112SelfTestStatus.status}`);
exitFor(report);
