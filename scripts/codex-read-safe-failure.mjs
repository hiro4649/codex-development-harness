#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.7

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const SAFE_FAILURE_READ_ORDER = [
  'codex-decision-capsule.safe.json',
  'codex-artifact-consistency.safe.json',
  'codex-minimal-blockers.safe.json',
  'codex-decision-core.safe.json',
  'codex-safe-artifact-index.safe.json',
];

function readJson(file) {
  try {
    if (!file || !fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function pickSafeFailureEvidence(dir = '.', order = SAFE_FAILURE_READ_ORDER) {
  if (dir && typeof dir === 'object' && !Array.isArray(dir)) {
    if (dir.decisionCapsule || dir.decisionArtifact) return { selected: 'codex-decision-capsule.safe.json', decisionArtifact: dir.decisionCapsule || dir.decisionArtifact };
    if (dir.artifactConsistency) return { selected: 'codex-artifact-consistency.safe.json', artifactConsistency: dir.artifactConsistency };
    if (dir.minimalBlockers) return { selected: 'codex-minimal-blockers.safe.json', minimalBlockers: dir.minimalBlockers };
    return { selected: 'none', acceptedEvidence: [], rejectedEvidence: SAFE_FAILURE_READ_ORDER };
  }
  const accepted = [];
  const rejected = [];
  for (const artifact of order) {
    const value = readJson(path.join(dir, artifact));
    if (value) accepted.push({ artifact, value });
    else rejected.push(artifact);
  }
  const decision = accepted.find((item) => item.artifact === 'codex-decision-capsule.safe.json')?.value;
  const consistency = accepted.find((item) => item.artifact === 'codex-artifact-consistency.safe.json')?.value;
  const minimal = accepted.find((item) => item.artifact === 'codex-minimal-blockers.safe.json')?.value;
  return {
    selected: accepted[0]?.artifact || 'none',
    decisionArtifact: decision || null,
    artifactConsistency: consistency || null,
    minimalBlockers: minimal || null,
    acceptedEvidence: accepted.map((item) => item.artifact),
    rejectedEvidence: rejected,
  };
}

export function renderSafeFailureLines(input = {}) {
  const decision = input.decisionArtifact || input.decisionCapsule || {};
  const consistency = input.artifactConsistency || {};
  const primaryClass = decision.primaryClass || consistency.primaryClass || input.primaryClass || 'unknown';
  const lines = [
    `decision: ${decision.decision || input.decision || 'blocked'}`,
    `head: ${decision.head || consistency.head || input.head || 'unknown'}`,
    `primaryClass: ${primaryClass}`,
    `blockingArtifact: ${consistency.artifactName || decision.detailsRef || input.blockingArtifact || 'unknown'}`,
    `acceptedEvidence: ${(input.acceptedEvidence || []).slice(0, 5).join(',') || 'none'}`,
    `rejectedEvidence: ${(input.rejectedEvidence || []).slice(0, 5).join(',') || 'none'}`,
    `repairType: ${decision.repairType || consistency.repairType || input.repairType || 'unknown'}`,
    `repairTargetFile: ${input.repairTargetFile || consistency.repairTargetFile || 'unknown'}`,
    `safeNextAction: ${decision.safeNextAction || consistency.safeNextAction || input.safeNextAction || 'owner_decision_or_state_delta'}`,
    `rawLogsRead: ${decision.rawLogsRead === true || input.rawLogsRead === true ? 'true' : 'false'}`,
  ];
  return lines.slice(0, 20);
}

export function validateSafeFailureReader(input = {}) {
  const order = input.readOrder || SAFE_FAILURE_READ_ORDER;
  const lines = renderSafeFailureLines({
    decisionArtifact: {
      decision: 'blocked',
      head: 'HEAD_SHA',
      primaryClass: 'artifact_index_consistency_failure',
      repairType: 'target_workflow_artifact_contract',
      safeNextAction: 'owner artifact-contract scope decision',
      rawLogsRead: false,
    },
    acceptedEvidence: order.slice(0, 2),
    rejectedEvidence: order.slice(2),
  });
  const reasonCodes = [];
  if (input.rawLogFallbackAttempted === true) reasonCodes.push('safe_failure_reader_raw_log_fallback');
  if (JSON.stringify(order) !== JSON.stringify(SAFE_FAILURE_READ_ORDER)) reasonCodes.push('safe_failure_reader_read_order_changed');
  if (lines.length > 20) reasonCodes.push('safe_failure_reader_output_too_long');
  if (lines.some((line) => /secret|token=|password|BEGIN PRIVATE/i.test(line))) reasonCodes.push('unsafe_failure_reader_output');
  return reasonCodes.length ? fail(reasonCodes, { lineCount: lines.length }) : pass({ readOrder: order, lineCount: lines.length });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2] || '.';
  const evidence = pickSafeFailureEvidence(dir);
  const lines = renderSafeFailureLines(evidence);
  console.log(lines.join('\n'));
  const report = {
    safeFailureReaderStatus: lines.length <= 20 ? pass({ lineCount: lines.length }) : fail('safe_failure_reader_output_too_long'),
    safeSummaryOnly: true,
  };
  writeJsonReport(report, 'CODEX_SAFE_FAILURE_READER_REPORT');
  exitFor(report);
}
