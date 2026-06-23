#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  canonicalJson,
  compileGoalContract,
  computeGoalDigest,
  parseJsonRejectDuplicateKeys,
} from './codex-v129-goal-contract.mjs';
import { classifyGoalTask } from './codex-v129-task-classifier.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch (error) {
    return { name, status: 'fail', reasonCodes: ['self_test_exception', String(error.message || error)], safeSummaryOnly: true };
  }
}

function passed(report) {
  return report?.status === 'pass' || report?.goalContractStatus?.status === 'pass' || report?.classificationStatus?.status === 'pass';
}

function failed(report) {
  return report?.status === 'fail' || report?.goalContractStatus?.status === 'fail' || report?.classificationStatus?.status === 'fail';
}

function baseGoal(overrides = {}) {
  const goal = {
    goalId: 'goal-v129-contract',
    goalVersion: 1,
    taskClass: 'code_change',
    truthOwnerRefs: [
      { path: 'docs/process/CODEX_V129_SPEC.md', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    ],
    desiredEndState: 'Add v1.2.9 source shadow contract without changing active authority.',
    acceptanceCriteria: [
      { id: 'AC1', description: 'v129 contract validates strict JSON.', required: true },
      { id: 'AC2', description: 'v128 compatibility remains pass.', required: true },
    ],
    constraints: ['Do not change activeHarnessVersion.', 'Do not add target rollout.'],
    nonGoals: ['No merge authority.', 'No target repository mutation.'],
    allowedFiles: ['docs/process/CODEX_V129_SPEC.md', 'scripts/codex-v129-goal-contract.mjs'],
    forbiddenFiles: ['scripts/codex-final-decision-kernel.mjs', '.github/workflows/quality-gate.yml'],
    evidencePlan: ['node scripts/codex-v129-self-test.mjs --stage=contract'],
    killCriteria: ['same blocker repeats once'],
    repairBudget: { maxRepairIterations: 1, sameBlockerMax: 1 },
    binding: {
      repositoryId: 1243452288,
      baseSha: '8e74e8d4843dea7ca41bfc50d2e66ad9079fc87d',
      scopeDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    goalDigest: 'placeholder',
    ...overrides,
  };
  goal.goalDigest = computeGoalDigest(goal);
  return goal;
}

function asText(goal) {
  return canonicalJson(goal);
}

function contractTests() {
  const valid = baseGoal();
  const reordered = {};
  for (const key of Object.keys(valid).reverse()) reordered[key] = valid[key];
  return [
    test('v129_valid_goal_compile_pass', () => passed(compileGoalContract(asText(valid)))),
    test('v129_key_order_change_same_digest', () => computeGoalDigest(valid) === computeGoalDigest(reordered)),
    test('v129_goal_tamper_fails', () => failed(compileGoalContract(asText({ ...valid, desiredEndState: 'tampered' })))),
    test('v129_duplicate_key_fails', () => {
      try {
        parseJsonRejectDuplicateKeys('{"goalId":"a","goalId":"b"}');
        return false;
      } catch {
        return true;
      }
    }),
    test('v129_unknown_field_fails', () => failed(compileGoalContract(asText({ ...valid, extraField: true, goalDigest: computeGoalDigest({ ...valid, extraField: true }) })))),
    test('v129_allowed_forbidden_overlap_fails', () => {
      const goal = baseGoal({ forbiddenFiles: ['docs/process/CODEX_V129_SPEC.md'] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_acceptance_id_duplicate_fails', () => {
      const goal = baseGoal({ acceptanceCriteria: [
        { id: 'AC1', description: 'one', required: true },
        { id: 'AC1', description: 'two', required: true },
      ] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repair_budget_overflow_fails', () => {
      const goal = baseGoal({ repairBudget: { maxRepairIterations: 2, sameBlockerMax: 1 } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repair_budget_negative_fails', () => {
      const goal = baseGoal({ repairBudget: { maxRepairIterations: -1, sameBlockerMax: 1 } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repository_id_string_fails', () => {
      const goal = baseGoal({ binding: { ...baseGoal().binding, repositoryId: 'hiro4649/codex-development-harness' } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_desired_end_state_non_string_fails', () => {
      const goal = baseGoal({ desiredEndState: { text: 'not-string' } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_truth_owner_duplicate_path_fails', () => {
      const goal = baseGoal({ truthOwnerRefs: [
        { path: 'docs/process/CODEX_V129_SPEC.md', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { path: './docs/process/CODEX_V129_SPEC.md', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_truth_owner_digest_missing_fails', () => {
      const goal = baseGoal({ truthOwnerRefs: [{ path: 'docs/process/CODEX_V129_SPEC.md' }] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_acceptance_id_gap_fails', () => {
      const goal = baseGoal({ acceptanceCriteria: [
        { id: 'AC1', description: 'one', required: true },
        { id: 'AC3', description: 'gap', required: true },
      ] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_array_count_limit_fails', () => {
      const goal = baseGoal({ constraints: Array.from({ length: 25 }, (_, index) => `constraint ${index}`) });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_string_byte_limit_fails', () => {
      const goal = baseGoal({ desiredEndState: 'x'.repeat(1201) });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_authority_file_classifies_authority_change', () => classifyGoalTask(baseGoal({ allowedFiles: ['scripts/codex-final-decision-kernel.mjs'] })).taskClass === 'authority_change'),
    test('v129_authority_like_filename_not_exact_path_does_not_classify_authority', () => classifyGoalTask(baseGoal({
      allowedFiles: ['docs/process/final-decision-kernel-not-authority.md'],
      forbiddenFiles: ['README.md'],
      desiredEndState: 'Change a source helper.',
      constraints: ['keep tests passing'],
      nonGoals: ['No product behavior change.'],
      evidencePlan: ['run focused self-test'],
      killCriteria: ['stop once'],
    })).taskClass !== 'authority_change'),
    test('v129_security_file_classifies_security_task', () => classifyGoalTask(baseGoal({
      allowedFiles: ['docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md'],
      forbiddenFiles: ['README.md'],
      desiredEndState: 'Run a security scan contract.',
      constraints: ['security scan'],
      nonGoals: ['No product change.'],
      evidencePlan: ['safe security report'],
      killCriteria: ['stop once'],
    })).taskClass === 'security_scan'),
    test('v129_metadata_task_classifies_low', () => {
      const report = classifyGoalTask(baseGoal({
        taskClass: 'routine_metadata',
        allowedFiles: ['README.md'],
        forbiddenFiles: ['docs/private.md'],
        desiredEndState: 'metadata manifest update',
        constraints: ['keep current behavior'],
        nonGoals: ['No product behavior change.'],
        evidencePlan: ['review README metadata'],
        killCriteria: ['stop once'],
      }));
      return report.taskClass === 'routine_metadata' && report.difficulty === 'low';
    }),
    test('v129_model_self_claim_difficulty_upgrade_fails', () => failed(classifyGoalTask(valid, { modelClaimedDifficulty: 'critical' }))),
  ];
}

function selectedStages() {
  const arg = process.argv.find((item) => item.startsWith('--stage='));
  if (!arg) return new Set(['contract', 'routing', 'verifier']);
  const stage = arg.split('=')[1];
  if (stage === 'all') return new Set(['contract', 'routing', 'verifier']);
  return new Set(stage.split(',').map((item) => item.trim()).filter(Boolean));
}

const stages = selectedStages();
const cases = [
  ...(stages.has('contract') ? contractTests() : []),
];
const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v129SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    stages: [...stages],
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report);
if (process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v129SelfTestStatus: ${report.status}`);
}
exitFor(report.status);
