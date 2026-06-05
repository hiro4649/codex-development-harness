#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildComplexityGovernanceReport, buildComplexityEvalSuiteReport } from './codex-complexity-governance-gate.mjs';

function assertCase(name, ok, failures, cases, detail = '') {
  cases.push({ name, status: ok ? 'pass' : 'fail', detail: String(detail || '').slice(0, 120), safeSummaryOnly: true });
  if (!ok) failures.push(name);
}

function prEnv(overrides = {}) {
  return {
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_NUMBER: '88',
    CODEX_PR_HEAD_SHA: 'v088-fixture-head',
    CODEX_COMPLEXITY_GOVERNANCE_MODE: 'enforce',
    CODEX_CHANGED_FILES: 'README.md',
    CODEX_PR_BODY: 'Task mode: docs_only\nGoal: docs update\nVerification: static check pass',
    ...overrides,
  };
}

function sourceHarnessPrBody() {
  return `PR profile: harness_workflow_r3
Risk level: R3

## Goal
Upgrade Codex Development Harness source to v0.8.8 Complexity-Aware Verification and Oracle Gate.

## Task Mode
Task mode: harness_change

## Complexity Governance
Complexity regime: high
Oracle required: yes
Oracle provided: v088 self-test; complexity eval cases; source/core local gate
Split required: no, source harness-only governance update with bounded files

## Task Contract
Goal: add v0.8.8 source harness complexity governance only
Done criteria: v088 self-test pass; source/core local gate pass; complexityGovernanceStatus pass
Verification surface: source harness validation commands
Risk surface: source harness gate behavior, PR body/evidence interpretation, complexity classification and oracle requirement
Allowed scope: source harness managed files
Forbidden scope: target repos, product runtime code, package/lockfile changes, profiles/*
Stop condition: stop if remote gate fails or current-head owner confirmation is missing

## Load-bearing evidence
Component: v0.8.8 complexity governance
Failure mode caught: high-complexity work without oracle
Not covered by existing gates: complexity classification and oracle requirement
Negative fixture: v088 self-test negative cases
Positive fixture: v088 self-test source harness-only v0.8.8 fixture
Runtime cost: low
Default mode: enforce for PR context

## Testing
v088 self-test pass; complexity eval cases pass; source/core local gate pass

## Constraints
No target rollout.
No product runtime code.
No package or lockfile changes.
No runtime readiness claim.
`;
}

export function buildV088SelfTestReport() {
  const failures = [];
  const cases = [];
  let result;

  result = buildComplexityGovernanceReport({ CODEX_COMPLEXITY_GOVERNANCE_MODE: 'report' }).complexityGovernanceStatus;
  assertCase('no PR context -> not_applicable or pass', ['not_applicable', 'pass'].includes(result.status), failures, cases, result.status);

  result = buildComplexityGovernanceReport(prEnv()).complexityGovernanceStatus;
  assertCase('low_docs_only_pass', result.status === 'pass' && result.regime === 'low', failures, cases, `${result.status}/${result.regime}`);

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-bug.mjs',
    CODEX_PR_BODY: 'Task mode: bugfix\n## Bugfix Evidence\nReproduced: yes\nRoot cause: fixture\nVerification: test pass\nDone criteria: bug fixed',
  })).complexityGovernanceStatus;
  assertCase('medium_bugfix_with_evidence_pass', result.status === 'pass' && result.regime === 'medium', failures, cases, `${result.status}/${result.regime}`);

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-bug.mjs',
    CODEX_PR_BODY: 'Task mode: bugfix\n## Bugfix Evidence\nReproduced: yes\nVerification: test pass',
  })).complexityGovernanceStatus;
  assertCase('medium_bugfix_missing_root_cause_fail', result.status === 'fail' && result.reasonCodes.includes('bugfix_review_evidence_missing'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'src/auth/login.ts',
    CODEX_PR_BODY: 'Task mode: feature\nGoal: auth change\n## Task Contract\nDone criteria: pass\nVerification surface: test pass\nRisk surface: auth\nAllowed scope: auth\nForbidden scope: package\nStop condition: stop\nOracle provided: test\n',
  })).complexityGovernanceStatus;
  assertCase('high_auth_without_negative_test_fail', result.status === 'fail' && result.reasonCodes.includes('oracle_required_for_auth_surface'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'src/db/repository.ts',
    CODEX_PR_BODY: 'Task mode: feature\nGoal: storage change\n## Task Contract\nDone criteria: pass\nVerification surface: manual check\nRisk surface: storage\nAllowed scope: storage\nForbidden scope: package\nStop condition: stop\nOracle provided: manual_check\n',
  })).complexityGovernanceStatus;
  assertCase('high_storage_without_integrity_evidence_manual', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('oracle_required_for_storage_surface'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-release.mjs',
    CODEX_PR_BODY: 'Task mode: release_gate\nProduction readiness claimed: yes\n## Task Contract\nDone criteria: release\nVerification surface: review\nRisk surface: release\nAllowed scope: release\nForbidden scope: product\nStop condition: stop',
  })).complexityGovernanceStatus;
  assertCase('high_release_claim_without_oracle_fail', result.status === 'fail' && result.reasonCodes.includes('high_complexity_oracle_missing'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'src/runtime/server.ts',
    CODEX_PR_BODY: 'Task mode: release_gate\nRuntime readiness claimed: yes\nOracle provided: fixture\nVerification: fixture pass\n## Task Contract\nDone criteria: ready\nVerification surface: fixture\nRisk surface: runtime\nAllowed scope: runtime\nForbidden scope: package\nStop condition: stop',
  })).complexityGovernanceStatus;
  assertCase('runtime_ready_fixture_only_fail', result.status === 'fail' && result.reasonCodes.includes('fixture_not_sufficient_for_runtime_claim'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-rollout.mjs',
    CODEX_PR_BODY: 'Task mode: harness_change\nGoal: target rollout with target repo changes\nForbidden scope: target repos\n## Task Contract\nDone criteria: done\nVerification surface: gate\nRisk surface: target rollout\nAllowed scope: source harness\nStop condition: stop\nOracle provided: test',
  })).complexityGovernanceStatus;
  assertCase('constraint_conflict_fail', result.status === 'fail' && result.reasonCodes.includes('solvability_constraints_conflict'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-tool.mjs',
    CODEX_PR_BODY: 'Task mode: feature\nGoal: browser check\nRequired tools: browser\nMissing tools: browser\nOracle provided: unavailable_with_reason\n## Task Contract\nDone criteria: document risk\nVerification surface: manual check\nRisk surface: tool availability\nAllowed scope: harness\nForbidden scope: product\nStop condition: stop',
  })).complexityGovernanceStatus;
  assertCase('tool_unavailable_weakens_evidence_manual', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('verification_weakened_by_missing_tool'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'src/runtime/server.ts',
    CODEX_PR_BODY: 'Task mode: release_gate\nRuntime readiness claimed: yes\nRequired tools: smoke\nMissing tools: smoke\nVerification: pass\n## Task Contract\nDone criteria: ready\nVerification surface: smoke\nRisk surface: runtime\nAllowed scope: runtime\nForbidden scope: package\nStop condition: stop\nOracle provided: smoke',
  })).complexityGovernanceStatus;
  assertCase('tool_unavailable_blocks_runtime_ready_fail', result.status === 'fail' && result.reasonCodes.includes('verification_blocked_by_missing_tool'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-large.mjs',
    CODEX_PR_BODY: 'Task mode: feature\nGoal: many-step large output task\n## Task Contract\nDone criteria: done\nVerification surface: manual explanation\nRisk surface: large output\nAllowed scope: harness\nForbidden scope: product\nStop condition: stop\nOracle provided: manual_check\nmanual explanation only',
  })).complexityGovernanceStatus;
  assertCase('algorithmic_artifact_required_fail', result.status === 'fail' && result.reasonCodes.includes('algorithmic_artifact_required'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: Array.from({ length: 16 }, (_, i) => `src/module${i}.ts`).join('\n'),
    CODEX_DIFF_NUMSTAT: Array.from({ length: 16 }, (_, i) => `10\t10\tsrc/module${i}.ts`).join('\n'),
    CODEX_PR_BODY: 'Task mode: feature\nGoal: large product diff\n## Task Contract\nDone criteria: done\nVerification surface: test pass\nRisk surface: runtime\nAllowed scope: product\nForbidden scope: package\nStop condition: stop\nOracle provided: test\nVerification: test pass',
  })).complexityGovernanceStatus;
  assertCase('split_required_for_large_product_diff_manual', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('split_required_for_large_diff'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-complexity-governance-gate.mjs\ndocs/process/CODEX_COMPLEXITY_GOVERNANCE_POLICY.md',
    CODEX_PR_BODY: sourceHarnessPrBody(),
  })).complexityGovernanceStatus;
  assertCase('harness_only_gate_change_with_self_test_pass', result.status === 'pass' && result.regime === 'high', failures, cases, `${result.status}/${result.regime}/${result.reasonCodes?.join(',')}`);

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-complexity-governance-gate.mjs\nsrc/runtime/server.ts',
    CODEX_PR_BODY: 'Task mode: harness_change\nGoal: mixed harness and product\n## Task Contract\nDone criteria: done\nVerification surface: test\nRisk surface: mixed\nAllowed scope: harness\nForbidden scope: product\nStop condition: stop\nOracle provided: test\nVerification: test pass',
  })).complexityGovernanceStatus;
  assertCase('harness_change_mixed_with_product_files_fail', result.status === 'fail' && result.reasonCodes.includes('harness_change_mixed_with_product_files'), failures, cases, result.reasonCodes?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'src/runtime/server.ts',
    CODEX_PR_BODY: 'Task mode: feature\nGoal: product change\n## Task Contract\nDone criteria: done\nVerification surface: test\nRisk surface: runtime\nAllowed scope: product\nForbidden scope: package\nStop condition: stop\nOracle provided: test\nVerification: test pass',
    CODEX_PRODUCT_VERIFICATION_JSON: JSON.stringify({ productVerificationStatus: { status: 'fail', reasonCodes: ['product_verification_failed'], safeSummaryOnly: true } }),
  })).complexityGovernanceStatus;
  assertCase('product_verification_fail_remains_fail', result.status === 'fail' && result.reasonCodes.includes('product_verification_failed'), failures, cases, result.reasonCodes?.join(','));

  const evalSuite = buildComplexityEvalSuiteReport().complexityEvalSuiteStatus;
  assertCase('complexity eval suite fixtures -> pass', evalSuite.status === 'pass', failures, cases, evalSuite.failures?.join(','));

  result = buildComplexityGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'docs/process/CODEX_COMPLEXITY_GOVERNANCE_POLICY.md\ndocs/process/CODEX_COMPLEXITY_EVAL_CASES.json\nscripts/codex-complexity-governance-gate.mjs\nscripts/codex-v088-self-test.mjs',
    CODEX_PR_BODY: sourceHarnessPrBody(),
  })).complexityGovernanceStatus;
  assertCase('source harness-only v0.8.8 PR fixture pass', result.status === 'pass' && result.regime === 'high', failures, cases, `${result.status}/${result.regime}/${result.reasonCodes?.join(',')}`);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v088SelfTestStatus: {
      status: failures.length ? 'fail' : 'pass',
      casesRun: cases.length,
      failures,
      cases,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildV088SelfTestReport();
    writeJsonReport(report, 'CODEX_V088_SELF_TEST_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('v088SelfTestStatus', 'fail', { failures: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_V088_SELF_TEST_REPORT');
    process.exit(1);
  }
}
