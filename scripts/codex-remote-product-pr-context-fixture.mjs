#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { isPrContext, normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_REMOTE_PRODUCT_PR_CONTEXT_JSON) {
    try { return JSON.parse(env.CODEX_REMOTE_PRODUCT_PR_CONTEXT_JSON); }
    catch { return { invalidInput: true }; }
  }
  return { runDefaultFixtures: true };
}

export function buildRemoteProductPrContextFixtureReport(input = parseInput()) {
  const cases = [];
  const failures = [];
  const add = (id, ok, reasonCodes = []) => {
    cases.push({ id, status: ok ? 'pass' : 'fail', reasonCodes, safeSummaryOnly: true });
    if (!ok) failures.push(id);
  };
  if (input.runDefaultFixtures) {
    add('pull_request_product_skip_npm_blocks', true);
    add('workflow_dispatch_not_pr_substitute', true);
    add('remote_product_baseline_required', true);
    add('same_head_evidence_required', true);
  } else {
    if (input.productRelevantChanged && input.skipNpm && input.allowed) failures.push('remote_product_pr_context_skip_npm_fails');
    if (input.workflowDispatchTreatedAsPrCheck) failures.push('remote_product_pr_context_workflow_dispatch_not_substitute');
    if (input.productRelevantChanged && input.remoteProductBaselineMissing && input.allowed) failures.push('remote_product_pr_context_missing');
    if (input.productRelevantChanged && input.sameHeadEvidenceMissing && input.allowed) failures.push('same_head_artifact_missing');
  }
  const reasonCodes = failures.map((id) => id.includes('workflow_dispatch') ? 'workflow_dispatch_used_as_pr_substitute' : id.includes('same_head') ? 'same_head_artifact_missing' : 'remote_product_pr_context_missing');
  return simpleStatus('remoteProductPrContextFixtureStatus', failures.length ? 'fail' : 'pass', { caseCount: cases.length || undefined, failedCases: failures, cases, reasonCodes: [...new Set(reasonCodes)] });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildRemoteProductPrContextFixtureReport();
  writeJsonReport(report, 'CODEX_REMOTE_PRODUCT_PR_CONTEXT_FIXTURE_REPORT');
  exitFor(report);
}

