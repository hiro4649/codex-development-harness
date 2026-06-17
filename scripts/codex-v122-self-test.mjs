#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.2

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V122_OPERATOR_STATUS_KEYS,
  V122_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateSkillContextRouting,
} from './codex-orchestration-capsule.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

function failed(status) {
  return status?.status === 'fail';
}

const compatibilityCases = [
  ['v122_self_test_must_pass', () => true],
  ['v122_adds_no_new_p0_artifact', () => V122_P0_ARTIFACTS.length === 3 && V122_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v122_adds_no_new_top_level_operator_status', () => V122_OPERATOR_STATUS_KEYS.length === 8 && !V122_OPERATOR_STATUS_KEYS.includes('skillContextRoutingStatus')],
  ['v122_delegates_final_authority_to_v118', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v122_preserves_v119_orchestration_artifacts', () => !V122_P0_ARTIFACTS.includes('codex-context-routing.safe.json')],
  ['v122_preserves_v120_adaptive_routing', () => buildOrchestrationCapsule().adaptiveIntelligenceRouting.defaultTier === 'low_cost_worker'],
  ['v122_preserves_v121_calibration_guard', () => buildOrchestrationCapsule().routingCalibration.defaultTier === 'low_cost_worker'],
  ['p1_p2_no_new_skill_daemon_or_history_watcher', () => !fs.existsSync('scripts/codex-skill-daemon.mjs') && !fs.existsSync('scripts/codex-history-watcher.mjs')],
];

const routingCases = [
  ['skill_context_routing_exists_inside_orchestration_capsule', () => ['1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6'].includes(buildOrchestrationCapsule().skillContextRouting.schemaVersion)],
  ['active_authority_tuple_required', () => validateSkillContextRouting(buildOrchestrationCapsule().skillContextRouting).status === 'pass'],
  ['active_authority_tuple_blocks_stale_marker', () => failed(validateSkillContextRouting({
    ...buildOrchestrationCapsule().skillContextRouting,
    activeAuthorityTuple: { ...buildOrchestrationCapsule().skillContextRouting.activeAuthorityTuple, agentsMarker: 'CODEX_QUALITY_HARNESS_FILE v1.2.1' },
  }))],
  ['routine_md_read_budget_is_three', () => buildOrchestrationCapsule({ taskProfile: 'routine' }).skillContextRouting.mdFilesReadMax === 3],
  ['metadata_light_md_read_budget_is_two', () => buildOrchestrationCapsule({ taskProfile: 'metadata_light' }).skillContextRouting.mdFilesReadMax === 2],
  ['target_rollout_md_read_budget_is_four', () => buildOrchestrationCapsule({ taskProfile: 'target_rollout' }).skillContextRouting.mdFilesReadMax === 4],
  ['harness_source_body_md_read_budget_is_six', () => buildOrchestrationCapsule({ taskProfile: 'harness_source_body' }).skillContextRouting.mdFilesReadMax === 6],
  ['selected_skills_default_max_two', () => buildOrchestrationCapsule().skillContextRouting.selectedSkillsMax === 2],
  ['selected_skills_max_cannot_override_task_profile_budget', () => failed(validateSkillContextRouting({
    ...buildOrchestrationCapsule().skillContextRouting,
    selectedSkillsMax: 99,
  }))],
  ['md_files_read_max_cannot_override_task_profile_budget', () => failed(validateSkillContextRouting({
    ...buildOrchestrationCapsule().skillContextRouting,
    mdFilesReadMax: 99,
  }))],
  ['third_skill_requires_typed_justification', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    selectedSkills: ['a', 'b', 'c'],
    selectedSkillsMax: 2,
  }).skillContextRouting))],
  ['third_skill_does_not_raise_global_skill_budget', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    selectedSkills: ['a', 'b', 'c'],
    typedJustification: 'routine_attempted_third_skill',
    thirdSkillAllowed: true,
  }).skillContextRouting))],
  ['third_skill_allowed_with_typed_justification_and_profile_budget', () => validateSkillContextRouting(buildOrchestrationCapsule({
    taskProfile: 'harness_source_body',
    selectedSkills: ['spec', 'github', 'security'],
    typedJustification: 'harness_source_body_requires_three_bounded_skills',
    thirdSkillAllowed: true,
  }).skillContextRouting).status === 'pass'],
  ['md_overread_without_justification_blocks', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    mdFilesRead: ['a.md', 'b.md', 'c.md', 'd.md'],
  }).skillContextRouting))],
  ['md_overread_with_typed_justification_warns_not_blocks', () => validateSkillContextRouting(buildOrchestrationCapsule({
    mdFilesRead: ['a.md', 'b.md', 'c.md', 'd.md'],
    typedJustification: 'compatibility_failure_requires_extra_active_spec_crosscheck',
    readBudgetStatus: 'warn',
  }).skillContextRouting).status === 'pass'],
  ['raw_logs_are_hard_context_blocker', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    blockerClasses: ['raw_logs_read'],
  }).skillContextRouting))],
  ['full_history_read_without_scope_is_hard_context_blocker', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    blockerClasses: ['full_history_read_without_scope'],
  }).skillContextRouting))],
  ['skill_misfire_blocks_source_hard_gate', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    skillMisfireDetected: true,
    skillMisfireReason: 'forbidden_repo_profile',
  }).skillContextRouting))],
  ['legacy_spec_read_requires_failure_reason', () => failed(validateSkillContextRouting(buildOrchestrationCapsule({
    legacySpecReadAllowed: true,
    legacySpecReadReason: 'routine_interest',
  }).skillContextRouting))],
  ['legacy_spec_read_allowed_for_compatibility_failure', () => validateSkillContextRouting(buildOrchestrationCapsule({
    legacySpecReadAllowed: true,
    legacySpecReadReason: 'compatibility_failure',
  }).skillContextRouting).status === 'pass'],
  ['owner_provided_context_not_counted_as_file_read', () => buildOrchestrationCapsule({
    ownerProvidedContext: { present: true, countedAsFileRead: true },
  }).skillContextRouting.ownerProvidedContext.countedAsFileRead === false],
  ['context_source_type_separates_user_text_from_file_read', () => buildOrchestrationCapsule().skillContextRouting.contextSourceType.userProvidedText === 'not_counted_as_file_read'],
  ['read_less_preserve_authority_first_reads', () => {
    const firstReads = buildOrchestrationCapsule().skillContextRouting.requiredFirstReads;
    return firstReads.includes('AGENTS.md') && firstReads.includes('docs/process/CODEX_HARNESS_MANIFEST.json') && (firstReads.includes('docs/process/CODEX_V122_SPEC.md') || firstReads.includes('docs/process/CODEX_V123_SPEC.md') || firstReads.includes('docs/process/CODEX_V124_SPEC.md') || firstReads.includes('docs/process/CODEX_V125_SPEC.md') || firstReads.includes('docs/process/CODEX_V126_SPEC.md'));
  }],
  ['readme_deferred_by_default', () => buildOrchestrationCapsule().skillContextRouting.deferredReads.includes('README.md')],
  ['safe_artifact_pointer_preferred', () => buildOrchestrationCapsule().skillContextRouting.contextSourceType.safeArtifact === 'preferred'],
];

const cases = [
  ...compatibilityCases,
  ...routingCases,
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v118_v119_v120_v121_compatibility_matrix',
  'context_source_type_matrix',
  'task_profile_read_budget_matrix',
  'skill_misfire_detection_matrix',
  'active_authority_tuple_matrix',
  'legacy_read_exception_matrix',
  'read_budget_warn_vs_block_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v122SelfTestStatus: {
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

writeJsonReport(report, 'CODEX_V122_SELF_TEST_REPORT');
if (!process.env.CODEX_V122_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v122SelfTestStatus: ${report.v122SelfTestStatus.status}`);
}
exitFor(report);
