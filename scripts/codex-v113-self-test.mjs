#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.3

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  BOUNDARY_PROFILES,
  V113_STATUS_KEYS,
  buildArtifactReadOrderIndex,
  buildConversationCostLedger,
  buildDefaultV113Statuses,
  buildDecisionObject,
  buildMinimalBlockersArtifact,
  buildNonRuntimeSharedUtilityProfile,
  buildProgressiveGatePlan,
  buildRepairLoopReport,
  buildRepresentativeFixtureSuite,
  buildRolloutDryRun,
  buildSafeArtifactIndex,
  buildTargetRolloutSelectorManifest,
  buildV113Report,
  classifyLegacySelfTestLane,
  classifyReasonCode,
  detectDeadSpec,
  detectDecisionContradictions,
  detectOverEngineering,
  lintProSummary,
  splitRemoteEvidenceState,
  validatePrBody,
  validateTargetHarnessScopeFirewall,
} from './codex-v113-minimal-surface.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const statuses = buildDefaultV113Statuses();
const report = buildV113Report();
const blockers = buildMinimalBlockersArtifact({
  mergeBlocking: true,
  primaryBlockers: ['same_head_required_check_failed', 'safe_artifact_missing', 'owner_merge_instruction_absent', 'extra'],
  derivedFailures: ['typescript_failed', 'stale_metadata', 'required_check_failed', 'quality_gate_missing', 'artifact_missing', 'extra'],
  safeNextAction: 'read_minimal_blockers_artifact',
});
const readOrder = buildArtifactReadOrderIndex();
const reason = classifyReasonCode('typescript_same_head_required_check_failed');
const prBodyOk = validatePrBody();
const prBodyBad = validatePrBody({ shapeOk: false });
const legacyAdvisory = classifyLegacySelfTestLane({ lane: 'target_harness_only_rollout', reasonCode: 'legacy_self_test_unrelated_to_target_harness_only' });
const legacyTrueBlocker = classifyLegacySelfTestLane({ lane: 'target_harness_only_rollout', reasonCode: 'secret_leak_detected' });
const firewall = validateTargetHarnessScopeFirewall();
const progressive = buildProgressiveGatePlan();
const selector = buildTargetRolloutSelectorManifest();
const dryRun = buildRolloutDryRun();
const fixtures = buildRepresentativeFixtureSuite();
const decisionAllowed = buildDecisionObject();
const decisionBlocked = buildDecisionObject({ requiredCheckFailed: true });
const artifactIndex = buildSafeArtifactIndex();
const costLedger = buildConversationCostLedger();

const cases = [
  test('all_v113_status_keys_default_pass', () => V113_STATUS_KEYS.every((key) => statuses[key]?.status === 'pass')),
  test('v113_report_passes', () => report.status === 'pass'),
  test('v113_self_status_present', () => report.v113SelfTestStatus.status === 'pass'),
  test('minimal_blockers_artifact_compact', () => blockers.primaryBlockers.length === 3 && blockers.derivedFailures.length === 5 && blockers.rawLogsAllowed === false),
  test('minimal_blockers_artifact_first_read', () => readOrder.first === 'codex-minimal-blockers.safe.json'),
  test('reason_code_scope_classification', () => reason.scope === 'external_blocked' && reason.minimalFix === 'wait_for_state_delta'),
  test('repairability_classifier_blocks_current_pr', () => reason.unsafeToFixInCurrentPr === true),
  test('pr_body_demoted_from_machine_source', () => prBodyOk.prBodyDemotionStatus.prBodyMachinePrimary === false),
  test('pr_body_markdown_shape_passes_when_valid', () => prBodyOk.prBodyMarkdownShapeStatus.status === 'pass'),
  test('pr_body_markdown_shape_blocks_when_invalid', () => prBodyBad.prBodyMarkdownShapeStatus.status === 'fail'),
  test('pr_body_as_rendered_output_is_derived', () => prBodyOk.prBodyAsRenderedOutputV2Status.derivedOnly === true),
  test('legacy_self_test_lane_advisory_for_unrelated_target_rollout', () => legacyAdvisory.classification === 'advisory_compatibility'),
  test('legacy_true_blocker_remains_blocking', () => legacyTrueBlocker.classification === 'blocking' && legacyTrueBlocker.trueBlockerPreserved === true),
  test('target_harness_scope_firewall_passes_safe_defaults', () => firewall.status === 'pass'),
  test('target_harness_scope_firewall_blocks_external_cwd', () => validateTargetHarnessScopeFirewall({ childCwd: '..' }).status === 'fail'),
  test('progressive_gate_runner_starts_fast', () => progressive.fastGateFirst === true && progressive.order[0] === 'fast_gate'),
  test('progressive_gate_runner_has_runtime_budget', () => progressive.budgets.fastGateSeconds <= 20),
  test('boundary_macro_profiles_registered', () => Object.keys(BOUNDARY_PROFILES).length >= 11),
  test('boundary_macro_standard_profile_present', () => Boolean(BOUNDARY_PROFILES.STANDARD_HARNESS_ONLY_NO_RUNTIME_NO_PRODUCT_V113)),
  test('rollout_selector_file_budget_small', () => selector.changedCount <= 40 && selector.budget === 'pass'),
  test('rollout_dry_run_first_and_parity', () => dryRun.plannedChangedFilesHash === dryRun.actualChangedFilesHash && dryRun.parity === true),
  test('five_target_synthetic_fixtures_present', () => ['VOXWEAVE', 'IRIS-live2d-renderer', 'FUNKY', 'IRIS', 'CRIPTO-TIP'].every((key) => fixtures[key]?.status === 'pass')),
  test('cripto_fixture_preserves_blocked_typescript_state', () => fixtures['CRIPTO-TIP'].typescript === 'fail' && fixtures['CRIPTO-TIP'].merge === 'blocked'),
  test('single_decision_object_allowed', () => decisionAllowed.decision === 'allowed' && decisionAllowed.safeSummaryOnly === true),
  test('single_decision_object_blocks_required_check', () => decisionBlocked.decision === 'blocked_by_required_check' && decisionBlocked.merge === 'blocked'),
  test('decision_contradiction_passes_consistent_state', () => detectDecisionContradictions({ merge: 'blocked', requiredChecksPass: false, qualityScore: 95, hardBlockerCount: 0 }).status === 'pass'),
  test('decision_contradiction_blocks_allowed_failed_required_check', () => detectDecisionContradictions({ merge: 'allowed', requiredChecksPass: false }).status === 'fail'),
  test('safe_artifact_index_entry_points', () => artifactIndex.decision === 'codex-decision-object.safe.json' && artifactIndex.minimalBlockers === 'codex-minimal-blockers.safe.json'),
  test('conversation_cost_ledger_no_full_json_console', () => costLedger.fullJsonConsoleLines === 0 && costLedger.visibleStatusCount <= 7),
  test('pro_summary_lint_blocks_long_report', () => lintProSummary({ finalReportLines: 31 }).status === 'fail'),
  test('dead_spec_detector_passes_traced_requirements', () => detectDeadSpec().status === 'pass'),
  test('dead_spec_detector_blocks_untraced_requirement', () => detectDeadSpec({ requirements: ['a', 'b'], traced: ['a'] }).status === 'fail'),
  test('over_engineering_detector_passes_budget', () => detectOverEngineering({ newDocs: 3, newScripts: 2, operatorVisibleStatuses: 7 }).status === 'pass'),
  test('over_engineering_detector_blocks_wrapper_without_value', () => detectOverEngineering({ wrapperWithoutDecisionValue: true }).status === 'fail'),
  test('repair_loop_prevention_warns_before_block', () => buildRepairLoopReport({ repairPrCount: 2 }).fixtureRequired === true),
  test('repair_loop_prevention_blocks_third_repair', () => buildRepairLoopReport({ repairPrCount: 3 }).status === 'fail'),
  test('remote_evidence_state_split_not_required', () => splitRemoteEvidenceState({ required: false }) === 'not_required'),
  test('remote_evidence_state_split_failed_execution', () => splitRemoteEvidenceState({ required: true, executed: true, artifactPresent: true, pass: false }) === 'executed_fail'),
  test('non_runtime_shared_utility_profile_passes_safe_common_path', () => buildNonRuntimeSharedUtilityProfile({ files: ['src/common/safe-helper.ts'] }).status === 'pass'),
  test('non_runtime_shared_utility_profile_blocks_runtime_import', () => buildNonRuntimeSharedUtilityProfile({ runtimeImport: true }).status === 'fail'),
  test('artifact_payloads_are_safe_summary_only', () => report.artifacts.safeArtifactIndex.safeSummaryOnly === true && report.artifacts.minimalBlockers.safeSummaryOnly === true && report.artifacts.decisionObject.safeSummaryOnly === true),
  test('source_only_non_goals_preserved', () => report.targetRollout === 'not_started' && report.targetReposTouched === false && report.productCodeChanged === false),
  test('readiness_non_claims_preserved', () => report.runtimeReadinessClaimed === false && report.productionReadinessClaimed === false),
  test('no_raw_logs_no_8_session_no_wallet_rpc', () => report.rawLogsRead === false && report.eightSessionUsed === false && report.walletRpcDeployAccess === false),
];

const failures = cases.filter((item) => item.status !== 'pass');
const selfTestReport = {
  v113SelfTestStatus: { status: failures.length ? 'fail' : 'pass', caseCount: cases.length, failureCount: failures.length, safeSummaryOnly: true },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(selfTestReport, 'CODEX_V113_SELF_TEST_REPORT');
if (!process.env.CODEX_V113_SELF_TEST_REPORT) console.log(`v113SelfTestStatus: ${selfTestReport.v113SelfTestStatus.status}`);
exitFor(selfTestReport);
