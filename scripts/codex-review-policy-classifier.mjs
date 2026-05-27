#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_REVIEW_POLICY_CLASSIFIER_JSON) {
    try { return JSON.parse(env.CODEX_REVIEW_POLICY_CLASSIFIER_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {};
}

export function classifyReviewRisk(input = {}) {
  const files = (input.changedFiles || []).map(normalizePath);
  const classes = new Set();
  if (!files.length && input.harnessOnly !== false) classes.add('harness_only');
  if (files.length && files.every((file) => /^docs\//.test(file) || file === 'README.md')) classes.add('docs_only');
  if (files.some((file) => /^scripts\/codex-|^docs\/process\//.test(file))) classes.add('harness_only');
  if (files.some((file) => /^\.github\/workflows\//.test(file))) classes.add('workflow_change');
  if (files.some((file) => /security|auth|permission|secret/i.test(file)) || input.securityRelevant) classes.add('security_relevant');
  if (files.some((file) => /Dockerfile|docker-compose|compose.*\.ya?ml|docker/i.test(file)) || input.dockerRelevant) classes.add('docker_relevant');
  if (files.some((file) => /^(src|apps|contracts|tests|test|public|assets)\//.test(file)) || input.productRelevant) classes.add('product_relevant');
  if (input.runtimeRelevant) classes.add('runtime_relevant');
  if (input.databaseRelevant) classes.add('database_relevant');
  if (input.targetRollout) classes.add('target_rollout');
  return [...classes];
}

export function buildReviewPolicyClassifierReport(input = parseInput()) {
  const riskClasses = classifyReviewRisk(input);
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('review_policy_classifier_failed');
  if (riskClasses.includes('security_relevant') && !input.reviewIndependencePass) reasonCodes.push('review_policy_classifier_failed');
  if (riskClasses.includes('workflow_change') && !input.securityLifecyclePass) reasonCodes.push('review_policy_classifier_failed');
  if (riskClasses.includes('docker_relevant') && !input.dockerSmokeCurrentHeadArtifactPass) reasonCodes.push('docker_smoke_artifact_missing');
  if (riskClasses.includes('product_relevant') && !input.oraclePresent) reasonCodes.push('product_verification_required');
  if (riskClasses.includes('target_rollout') && !input.hotfixPreservationPass) reasonCodes.push('target_hotfix_overwritten');
  if (riskClasses.includes('docs_only') && input.heavyReviewRequired) warnings.push('docs_only_heavy_review_unnecessary');
  if (riskClasses.includes('harness_only') && input.largeDiffNoSplitReason) warnings.push('harness_only_large_diff_needs_split_reason');
  const status = reasonCodes.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
  return simpleStatus('reviewPolicyClassifierStatus', status, { riskClasses, reasonCodes: [...new Set(reasonCodes)], warnings });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildReviewPolicyClassifierReport();
  writeJsonReport(report, 'CODEX_REVIEW_POLICY_CLASSIFIER_REPORT');
  exitFor(report);
}

