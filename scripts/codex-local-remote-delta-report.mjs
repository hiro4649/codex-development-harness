#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildLocalRemoteDeltaReport, buildLocalRemoteDeltaStatusReport } from './codex-v108-gate-lib.mjs';

const input = {
  localTargetGate: process.env.CODEX_LOCAL_TARGET_GATE || 'not_run',
  remoteQualityGate: process.env.CODEX_REMOTE_QUALITY_GATE || 'not_run',
  remoteNpmWiring: process.env.CODEX_REMOTE_NPM_WIRING === '1',
  remoteArtifactMissing: process.env.CODEX_REMOTE_ARTIFACT_MISSING === '1',
  remoteBodyStale: process.env.CODEX_REMOTE_BODY_STALE === '1',
  remoteHeadMismatch: process.env.CODEX_REMOTE_HEAD_MISMATCH === '1',
  remoteFormalEvidenceIgnored: process.env.CODEX_REMOTE_FORMAL_EVIDENCE_IGNORED === '1',
  formalCurrentHeadEvidencePass: process.env.CODEX_FORMAL_CURRENT_HEAD_EVIDENCE_PASS === '1',
  staleTempDiagnostic: process.env.CODEX_STALE_TEMP_DIAGNOSTIC === '1',
};
const delta = buildLocalRemoteDeltaReport(input);
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...delta,
  ...buildLocalRemoteDeltaStatusReport(input),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_LOCAL_REMOTE_DELTA_REPORT');
exitFor(report);
