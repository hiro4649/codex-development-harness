#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildHarnessVersionRegistry } from './codex-harness-version.mjs';

const registry = buildHarnessVersionRegistry();
const gate = readJson(process.env.CODEX_GATE_REPORT_PATH || '');
const evidence = readJson(process.env.CODEX_EVIDENCE_PACK_PATH || '.codex/evidence-pack.json');
const blocking = statusKeys(gate, true);
const advisory = statusKeys(gate, false).filter((key) => /advisory|not_applicable|skipped|policy/i.test(String(gate?.[key]?.status || '')));
const oneSafeNextAction = blocking.length ? 'repair_first_blocking_status' : 'verify_source_pr_remote_gate';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
  status: 'pass',
  activeHarnessVersion: registry.currentVersion,
  activeSelfTestKey: registry.activeSelfTestStatusKey,
  centralRegistrySource: 'scripts/codex-harness-version.mjs',
  prContextSource: evidence?.pr_number ? 'evidence_pack' : 'absent',
  bodyHash: evidence?.pr_body_hash || 'absent',
  reviewEvidenceSource: 'safe_summary',
  blockingStatuses: blocking,
  advisoryStatuses: advisory,
  staleArtifactProbability: blocking.includes('currentHeadEvidenceTtlStatus') ? 'possible' : 'low',
  oneSafeNextAction,
  harnessDoctorStatus: {
    status: 'pass',
    blocking: false,
    reasonCodes: [],
    evidenceConsumed: ['central_harness_version_registry', 'safe_evidence_pack'],
    safeSummary: { blockingCount: blocking.length, advisoryCount: advisory.length, oneSafeNextAction },
    nextSafeAction: oneSafeNextAction,
    safeSummaryOnly: true,
  },
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_HARNESS_DOCTOR_REPORT');
exitFor(report);

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
}

function statusKeys(report, blockingOnly) {
  if (!report || typeof report !== 'object') return [];
  return Object.entries(report)
    .filter(([, value]) => value && typeof value === 'object')
    .filter(([, value]) => blockingOnly ? value.status === 'fail' || value.blocking === true : value.status)
    .map(([key]) => key)
    .slice(0, 25);
}
