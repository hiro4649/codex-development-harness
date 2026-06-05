#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7

import fs from 'node:fs';
import crypto from 'node:crypto';
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const out = process.env.CODEX_EVIDENCE_PACK_PATH || '.codex/evidence-pack.json';
const input = parseJson(process.env.CODEX_GITHUB_SAFE_CONTEXT_JSON) || {};

const pack = {
  schemaVersion: '1.0.7',
  source_head_sha: safeHash(input.headSha),
  base_sha: safeHash(input.baseSha),
  pr_number: Number(input.prNumber || 0),
  run_id: Number(input.runId || 0),
  artifact_id: Number(input.artifactId || 0),
  changed_file_count: Array.isArray(input.changedFiles) ? input.changedFiles.length : 0,
  check_summary: summarizeChecks(input.checks),
  pr_body_hash: safeHash(input.prBody || ''),
  test_summary_json: input.testSummary || { status: 'not_applicable', safeSummaryOnly: true },
  quality_score: Number(input.qualityScore || 0),
  status_summary: input.statusSummary || {},
  risk_register: input.riskRegister || [],
  manual_gate_summary: input.manualGateSummary || [],
  readiness_claims: input.readinessClaims || { runtime: false, production: false },
  product_code_changed: Boolean(input.productCodeChanged),
  target_repos_touched: Boolean(input.targetReposTouched),
  raw_logs_stored: false,
  raw_pr_body_stored: false,
  safe_summary_only: true,
};

fs.mkdirSync('.codex', { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(pack, null, 2)}\n`);

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
  status: scanObjectForUnsafe(pack).length ? 'fail' : 'pass',
  githubRunArtifactAutoInjectStatus: {
    status: scanObjectForUnsafe(pack).length ? 'fail' : 'pass',
    blocking: scanObjectForUnsafe(pack).length > 0,
    reasonCodes: scanObjectForUnsafe(pack).length ? ['unsafe_value_detected'] : [],
    evidenceConsumed: ['github_safe_context'],
    safeSummary: { evidencePackWritten: true, changedFileCount: pack.changed_file_count },
    nextSafeAction: 'render_pr_body_from_evidence_pack',
    safeSummaryOnly: true,
  },
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_GITHUB_RUN_ARTIFACT_AUTO_INJECT_REPORT');
exitFor(report);

function parseJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function safeHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function summarizeChecks(checks) {
  const list = Array.isArray(checks) ? checks : [];
  return {
    total: list.length,
    pass: list.filter((check) => check.conclusion === 'success' || check.status === 'pass').length,
    fail: list.filter((check) => check.conclusion === 'failure' || check.status === 'fail').length,
    pending: list.filter((check) => check.status === 'pending' || check.conclusion === null).length,
    safeSummaryOnly: true,
  };
}
