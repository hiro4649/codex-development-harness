#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5

import { fileURLToPath } from 'node:url';
import { marker, HARNESS_VERSION, scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildRemoteProductContextRestoreReport } from './codex-remote-product-context-restore-gate.mjs';
import { buildProductRelevantEvidenceLockReport } from './codex-product-relevant-evidence-lock-gate.mjs';
import { buildProductBaselineContinuityReport } from './codex-product-baseline-continuity-gate.mjs';
import { buildSkipNpmProductBypassReport } from './codex-skip-npm-product-bypass-gate.mjs';
import { buildPullRequestContextFidelityReport } from './codex-pull-request-context-fidelity-gate.mjs';
import { buildProductContextSafeArtifactReport } from './codex-product-context-safe-artifact-gate.mjs';
import { buildRuntimeJobSafetyReport } from './codex-runtime-job-safety-gate.mjs';
import { buildTxPathStateEvidenceReport } from './codex-tx-path-state-evidence-gate.mjs';
import { buildEnvConsistencyReport } from './codex-env-consistency-gate.mjs';
import { buildStagingNoTxPreflightReport } from './codex-staging-no-tx-preflight-gate.mjs';
import { buildRuntimeLogSecretScanReport } from './codex-runtime-log-secret-scan-gate.mjs';
import { buildChainScopeReport } from './codex-chain-scope-gate.mjs';
import { buildFalsePositiveBudgetReport } from './codex-false-positive-budget-gate.mjs';
import { buildTargetScriptClassificationFixtureReport, classifyTargetScript } from './codex-target-script-classification-fixture.mjs';
import { buildGithubReplayContextFromData } from './codex-ci-replay.mjs';

const HEAD = '1234567890abcdef1234567890abcdef12345678';
const OTHER = 'abcdef1234567890abcdef1234567890abcdef12';

function assertCase(id, condition, failures, cases, actualStatus = 'pass', reasonCodes = []) {
  cases.push({ id, status: condition ? 'pass' : 'fail', actualStatus, reasonCodes, safeSummaryOnly: true });
  if (!condition) failures.push(id);
}

export function buildV094SelfTestReport() {
  const failures = [];
  const cases = [];
  let report;

  report = buildRemoteProductContextRestoreReport({ isPullRequest: true, prNumber: '1', headSha: HEAD, baseSha: OTHER, changedFiles: ['src/app.ts'], productRelevant: true, productVerificationRequired: true, remoteProductBaselineRequired: true });
  assertCase('remote_product_context_present_in_pull_request_pass', report.remoteProductContextRestoreStatus.status === 'pass', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);
  const replayContext = buildGithubReplayContextFromData({ repo: 'owner/repo', pr: '1', head: HEAD }, {}, {
    ok: true,
    pr: { body: 'PR profile: harness_workflow_r3', head: { sha: HEAD }, base: { sha: OTHER } },
    comments: [],
    reviews: [],
    files: [{ filename: 'scripts/codex-local-quality-gate.mjs' }],
  });
  report = buildPullRequestContextFidelityReport({}, replayContext.env);
  assertCase('remote_product_context_replay_changed_files_pass', report.pullRequestContextFidelityStatus.status === 'pass', failures, cases, report.pullRequestContextFidelityStatus.status, report.pullRequestContextFidelityStatus.reasonCodes);

  report = buildRemoteProductContextRestoreReport({ isPullRequest: true, changedFiles: ['src/app.ts'], productRelevant: true, productVerificationRequired: false, remoteProductBaselineRequired: true });
  assertCase('remote_product_context_missing_fails', report.remoteProductContextRestoreStatus.status === 'fail', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);
  assertCase('product_relevant_changed_file_requires_product_verification', report.remoteProductContextRestoreStatus.status === 'fail', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);

  report = buildRemoteProductContextRestoreReport({ isPullRequest: true, changedFiles: ['src/app.ts'], productRelevant: true, productVerificationRequired: true, remoteProductBaselineRequired: false });
  assertCase('product_relevant_changed_file_requires_remote_baseline', report.remoteProductContextRestoreStatus.status === 'fail', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);

  report = buildSkipNpmProductBypassReport({ productRelevant: true, skipNpm: true });
  assertCase('product_relevant_with_skip_npm_fails', report.skipNpmProductBypassStatus.status === 'fail', failures, cases, report.skipNpmProductBypassStatus.status, report.skipNpmProductBypassStatus.reasonCodes);
  report = buildSkipNpmProductBypassReport({ harnessOnly: true, skipNpm: true, allowedReason: 'harness-only rollout' });
  assertCase('harness_only_with_skip_npm_passes', report.skipNpmProductBypassStatus.status === 'pass', failures, cases, report.skipNpmProductBypassStatus.status, report.skipNpmProductBypassStatus.reasonCodes);

  report = buildPullRequestContextFidelityReport({ isPullRequest: true, workflowDispatchTreatedAsPrCheck: true, prNumber: '2', headSha: HEAD, baseSha: OTHER, changedFiles: ['README.md'] });
  assertCase('workflow_dispatch_not_pr_substitute_fails', report.pullRequestContextFidelityStatus.status === 'fail', failures, cases, report.pullRequestContextFidelityStatus.status, report.pullRequestContextFidelityStatus.reasonCodes);
  report = buildRemoteProductContextRestoreReport({ isPullRequest: true, productRelevant: true, productVerificationRequired: true, remoteProductBaselineRequired: true, changedFiles: [] });
  assertCase('changed_files_empty_in_pr_context_fails', report.remoteProductContextRestoreStatus.status === 'fail', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);

  report = buildProductRelevantEvidenceLockReport({ productRelevant: true, productVerificationResult: true, remoteProductBaselineResult: true, npmBaselineRequired: true, npmBaselineResult: true });
  assertCase('same_head_product_evidence_pass', report.productRelevantEvidenceLockStatus.status === 'pass', failures, cases, report.productRelevantEvidenceLockStatus.status, report.productRelevantEvidenceLockStatus.reasonCodes);
  report = buildProductRelevantEvidenceLockReport({ productRelevant: true, productVerificationResult: true, remoteProductBaselineResult: true, sameHeadMismatch: true });
  assertCase('same_head_product_evidence_mismatch_fails', report.productRelevantEvidenceLockStatus.status === 'fail', failures, cases, report.productRelevantEvidenceLockStatus.status, report.productRelevantEvidenceLockStatus.reasonCodes);

  report = buildProductBaselineContinuityReport({ baselineResultPresent: true, finalSummaryIncludesBaseline: true });
  assertCase('baseline_continuity_survives_runner_pass', report.productBaselineContinuityStatus.status === 'pass', failures, cases, report.productBaselineContinuityStatus.status, report.productBaselineContinuityStatus.reasonCodes);
  report = buildProductBaselineContinuityReport({ baselineLostInFinalSummary: true });
  assertCase('baseline_continuity_lost_in_final_summary_fails', report.productBaselineContinuityStatus.status === 'fail', failures, cases, report.productBaselineContinuityStatus.status, report.productBaselineContinuityStatus.reasonCodes);
  report = buildProductBaselineContinuityReport({ baselineFailBecameDiagnosticPass: true });
  assertCase('product_baseline_fail_not_diagnostic_pass', report.productBaselineContinuityStatus.status === 'fail', failures, cases, report.productBaselineContinuityStatus.status, report.productBaselineContinuityStatus.reasonCodes);

  report = buildRemoteProductContextRestoreReport({ isPullRequest: true, changedFiles: ['src/app.ts'], productRelevant: true, productVerificationRequired: true, remoteProductBaselineRequired: true, targetRolloutProductContextMissing: false });
  assertCase('target_rollout_does_not_disable_product_context', report.remoteProductContextRestoreStatus.status === 'pass', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);
  report = buildTargetScriptClassificationFixtureReport({ manifest: { runTestsClassification: 'product_relevant', devServerClassification: 'dev_server_entrypoint' } });
  assertCase('scripts_run_tests_product_relevant_context_pass', report.targetScriptClassificationFixtureStatus.status === 'pass' && classifyTargetScript('scripts/run-tests.js', { runTestsClassification: 'product_relevant' }) === 'product_relevant', failures, cases, report.targetScriptClassificationFixtureStatus.status, report.targetScriptClassificationFixtureStatus.reasonCodes);

  report = buildProductContextSafeArtifactReport({ productContextFailure: true, classification: 'body_only_repair_allowed' });
  assertCase('safe_artifact_classifier_product_context_missing', report.productContextSafeArtifactStatus.status === 'fail', failures, cases, report.productContextSafeArtifactStatus.status, report.productContextSafeArtifactStatus.reasonCodes);
  report = buildProductContextSafeArtifactReport({ skipNpmBypass: true, classification: 'warning' });
  assertCase('safe_artifact_classifier_skip_npm_bypass_fail', report.productContextSafeArtifactStatus.status === 'fail', failures, cases, report.productContextSafeArtifactStatus.status, report.productContextSafeArtifactStatus.reasonCodes);
  report = buildProductContextSafeArtifactReport({ productEvidenceMissing: true, classification: 'merge_allowed' });
  assertCase('body_only_repair_does_not_hide_product_evidence_missing', report.productContextSafeArtifactStatus.status === 'fail', failures, cases, report.productContextSafeArtifactStatus.status, report.productContextSafeArtifactStatus.reasonCodes);

  report = buildRuntimeJobSafetyReport({ runtimeRelevant: true, runtimeReadinessClaimed: true, cronMultiProcess: true, ownershipEvidencePresent: false });
  assertCase('runtime_job_scheduler_tx_without_ownership_fails', report.runtimeJobSafetyStatus.status === 'fail', failures, cases, report.runtimeJobSafetyStatus.status, report.runtimeJobSafetyStatus.reasonCodes);
  report = buildRuntimeJobSafetyReport({ runtimeRelevant: true, externalApiPollingChanged: true, retryBackoffEvidencePresent: false });
  assertCase('runtime_job_external_api_polling_without_retry_warns', report.runtimeJobSafetyStatus.status === 'warning', failures, cases, report.runtimeJobSafetyStatus.status, report.runtimeJobSafetyStatus.reasonCodes);
  report = buildTxPathStateEvidenceReport({ txPathChanged: true, txSendingFunctionChanged: true, txHashPersistencePolicyPresent: false });
  assertCase('tx_path_without_txhash_receipt_policy_fails', report.txPathStateEvidenceStatus.status === 'fail', failures, cases, report.txPathStateEvidenceStatus.status, report.txPathStateEvidenceStatus.reasonCodes);
  report = buildRuntimeJobSafetyReport({ runtimeRelevant: true, processedBooleanOnlyProtection: true });
  assertCase('processed_boolean_only_double_send_fails', report.runtimeJobSafetyStatus.status === 'fail', failures, cases, report.runtimeJobSafetyStatus.status, report.runtimeJobSafetyStatus.reasonCodes);
  report = buildRuntimeJobSafetyReport({ runtimeRelevant: true, runtimeReadinessClaimed: true, ownershipEvidencePresent: true, workerBoundaryMissing: true });
  assertCase('worker_boundary_missing_with_runtime_readiness_fails', report.runtimeJobSafetyStatus.status === 'fail', failures, cases, report.runtimeJobSafetyStatus.status, report.runtimeJobSafetyStatus.reasonCodes);

  report = buildEnvConsistencyReport({ productRelevant: true, docsValidatorMismatch: true });
  assertCase('env_docs_validator_mismatch_fails', report.envConsistencyStatus.status === 'fail', failures, cases, report.envConsistencyStatus.status, report.envConsistencyStatus.reasonCodes);
  report = buildChainScopeReport({ forceCheck: true, stagingProdChainMixed: true });
  assertCase('staging_chain_prod_chain_mixed_fails', report.chainScopeStatus.status === 'fail', failures, cases, report.chainScopeStatus.status, report.chainScopeStatus.reasonCodes);
  report = buildStagingNoTxPreflightReport({ runtimeReadinessClaimed: true, noTxPreflightPresent: false });
  assertCase('staging_no_tx_readiness_without_log_scan_fails', report.stagingNoTxPreflightStatus.status === 'fail', failures, cases, report.stagingNoTxPreflightStatus.status, report.stagingNoTxPreflightStatus.reasonCodes);
  report = buildRuntimeLogSecretScanReport({ forceCheck: true, rawRuntimeLogsIncluded: true });
  assertCase('runtime_log_raw_output_fails', report.runtimeLogSecretScanStatus.status === 'fail', failures, cases, report.runtimeLogSecretScanStatus.status, report.runtimeLogSecretScanStatus.reasonCodes);
  report = buildFalsePositiveBudgetReport({ bodyOnlyRepairCount: 5, maxBodyOnlyRepairCount: 2 });
  assertCase('false_positive_budget_body_only_loop_warns', report.falsePositiveBudgetStatus.status === 'warning', failures, cases, report.falsePositiveBudgetStatus.status, report.falsePositiveBudgetStatus.reasonCodes);

  report = buildProductBaselineContinuityReport({});
  assertCase('source_harness_only_v094_pr_fixture_pass', report.productBaselineContinuityStatus.status === 'pass', failures, cases, report.productBaselineContinuityStatus.status, report.productBaselineContinuityStatus.reasonCodes);
  report = buildRemoteProductContextRestoreReport({ forceCheck: true, productRelevant: false, changedFiles: ['docs/process/CODEX_HARNESS_MANIFEST.json'] });
  assertCase('target_harness_rollout_v094_fixture_pass', report.remoteProductContextRestoreStatus.status === 'pass', failures, cases, report.remoteProductContextRestoreStatus.status, report.remoteProductContextRestoreStatus.reasonCodes);

  const unsafe = scanObjectForUnsafe(cases);
  const status = failures.length || unsafe.length ? 'fail' : 'pass';
  return { marker, harnessVersion: HARNESS_VERSION, status, v094SelfTestStatus: { status, suite: 'v094', caseCount: cases.length, failedCaseCount: failures.length, failedCases: failures, cases, reasonCodes: unsafe.length ? ['unsafe_output_detected'] : [], safeSummaryOnly: true }, cases, safeSummaryOnly: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildV094SelfTestReport();
  writeJsonReport(report, 'CODEX_V094_SELF_TEST_REPORT');
  exitFor(report);
}
