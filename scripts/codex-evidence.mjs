#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';
import { classifyEvidenceMode, readEvidencePack, renderPrBodyFromEvidencePack, assertCleanWorktree } from './codex-v108-gate-lib.mjs';
import { sha256 } from './lib/codex-status-schema-v108.mjs';

const args = parseArgs(process.argv.slice(2));
const mode = args.mode || 'verify';
const pack = readEvidencePack(args.evidencePack || '.codex/evidence-pack.json');
const rendered = renderPrBodyFromEvidencePack(pack);
const bodyFile = args.bodyFile;
const bodyHash = bodyFile && fs.existsSync(bodyFile) ? sha256(fs.readFileSync(bodyFile, 'utf8')) : undefined;
const expectedBodyHash = pack.rendered_pr_body_sha256 || rendered.sha256;

if (mode === 'render' && args.out) {
  fs.mkdirSync(dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, rendered.body);
}

const ghAuthAvailable = mode !== 'publish' ? true : spawnSync('gh', ['auth', 'status'], { stdio: 'pipe' }).status === 0;
const cleanWorktree = mode !== 'publish' ? true : assertCleanWorktree();
const result = classifyEvidenceMode({
  mode,
  pr: args.pr,
  bodyFile,
  defaultBodyFile: args.defaultBodyFile === true,
  dirtyWorktree: !cleanWorktree,
  headSha: args.headSha || pack.source_head_sha,
  auditedHeadSha: pack.qualityGateArtifact?.auditedHeadSha || pack.source_head_sha,
  bodyHash,
  expectedBodyHash,
  ghAuthAvailable,
});

let published = false;
if (mode === 'publish' && result.status === 'pass' && args.dryRun !== true) {
  const edit = spawnSync('gh', ['pr', 'edit', String(args.pr), '--body-file', bodyFile], { stdio: 'pipe' });
  published = edit.status === 0;
  if (!published) result.reasonCodes.push('publish_mutation_failed');
}

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: result.reasonCodes.length ? 'fail' : 'pass',
  evidenceMode: mode,
  evidenceCommandStatus: {
    status: result.reasonCodes.length ? 'fail' : 'pass',
    blocking: result.reasonCodes.length > 0,
    reasonCodes: result.reasonCodes,
    evidenceConsumed: ['evidence_pack_v4'],
    safeSummary: {
      mode,
      rendered: mode === 'render' && Boolean(args.out),
      published,
      safeMutationAudit: result.safeMutationAudit || {},
    },
    nextSafeAction: result.reasonCodes.length ? 'repair_evidence_command_inputs' : 'continue_source_harness_validation',
    safeSummaryOnly: true,
  },
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.evidenceCommandStatus.status = 'fail';
  report.evidenceCommandStatus.reasonCodes = ['unsafe_value_detected'];
}

writeJsonReport(report, 'CODEX_EVIDENCE_COMMAND_REPORT');
exitFor(report);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function dirname(file) {
  const normalized = String(file).replace(/\\/g, '/');
  return normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '.';
}
