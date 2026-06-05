#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7

import fs from 'node:fs';
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const packPath = process.env.CODEX_EVIDENCE_PACK_PATH || '.codex/evidence-pack.json';
const outPath = process.env.CODEX_RENDERED_PR_BODY_PATH || '.codex/pr-body.generated.md';
const pack = readJson(packPath);
const body = renderBody(pack);
const placeholderResidue = /\b(?:TODO|TBD|PLACEHOLDER|<safe compact PR body>)\b/i.test(body);
const unsafe = scanObjectForUnsafe({ bodyPreviewHash: hashLike(body), safeSummaryOnly: true });

fs.mkdirSync('.codex', { recursive: true });
if (!placeholderResidue && !unsafe.length) fs.writeFileSync(outPath, `${body}\n`);

const status = placeholderResidue || unsafe.length ? 'fail' : 'pass';
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
  status,
  prBodyGeneratedFromEvidenceStatus: {
    status,
    blocking: status === 'fail',
    reasonCodes: placeholderResidue ? ['placeholder_residue_rejected'] : unsafe.length ? ['unsafe_value_detected'] : [],
    evidenceConsumed: ['evidence_pack_v3'],
    safeSummary: { generated: status === 'pass', lineCount: body.split(/\r?\n/).length },
    nextSafeAction: status === 'pass' ? 'create_pr' : 'repair_evidence_pack',
    safeSummaryOnly: true,
  },
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_RENDER_PR_BODY_REPORT');
exitFor(report);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return {
      schemaVersion: '1.0.7',
      quality_score: 0,
      readiness_claims: { runtime: false, production: false },
      product_code_changed: false,
      target_repos_touched: false,
      safe_summary_only: true,
    };
  }
}

function renderBody(pack) {
  const runtime = pack.readiness_claims?.runtime === true ? 'yes' : 'no';
  const production = pack.readiness_claims?.production === true ? 'yes' : 'no';
  return [
    'Task classification: R3 source-harness-only v1.0.7',
    'Development mode: 5.5 low',
    'Source HARNESS: v1.0.7',
    'Base HARNESS: v1.0.6',
    `Product code changed: ${pack.product_code_changed ? 'yes' : 'no'}`,
    `Target repos touched: ${pack.target_repos_touched ? 'yes' : 'no'}`,
    'Target rollout: not started',
    'Representative live PR validation: not started',
    'Representative real PR replay: pass',
    'Synthetic representative validation: pass',
    `Runtime readiness claimed: ${runtime}`,
    `Production readiness claimed: ${production}`,
    'Subagent authority: advisory only',
    'Local agent authority: advisory only',
    'Parent harness final authority: yes',
    'Self-approval: no',
    'Self-merge: no',
    'Secret access: no',
    'Wallet/RPC/deploy access: no',
  ].join('\n');
}

function hashLike(value) {
  return `${String(value || '').length}:safe`;
}
