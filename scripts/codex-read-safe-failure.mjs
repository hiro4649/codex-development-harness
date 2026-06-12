#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.9

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const SAFE_FAILURE_READ_ORDER = [
  'codex-orchestration-capsule.safe.json',
  'codex-worker-proof.safe.json',
  'codex-owner-decision-brief.safe.json',
  'codex-final-decision.safe.json',
  'codex-evidence-capsule.safe.json',
  'codex-minimal-blockers.safe.json',
  'codex-decision-capsule.safe.json',
  'codex-artifact-consistency.safe.json',
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
    if (dir.finalDecision) return { selected: 'codex-final-decision.safe.json', finalDecision: dir.finalDecision };
    if (dir.orchestrationCapsule) return { selected: 'codex-orchestration-capsule.safe.json', orchestrationCapsule: dir.orchestrationCapsule };
    if (dir.workerProofCapsule) return { selected: 'codex-worker-proof.safe.json', workerProofCapsule: dir.workerProofCapsule };
    if (dir.ownerDecisionBrief) return { selected: 'codex-owner-decision-brief.safe.json', ownerDecisionBrief: dir.ownerDecisionBrief };
    if (dir.evidenceCapsule) return { selected: 'codex-evidence-capsule.safe.json', evidenceCapsule: dir.evidenceCapsule };
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
  const finalDecision = accepted.find((item) => item.artifact === 'codex-final-decision.safe.json')?.value;
  const orchestrationCapsule = accepted.find((item) => item.artifact === 'codex-orchestration-capsule.safe.json')?.value;
  const workerProofCapsule = accepted.find((item) => item.artifact === 'codex-worker-proof.safe.json')?.value;
  const ownerDecisionBrief = accepted.find((item) => item.artifact === 'codex-owner-decision-brief.safe.json')?.value;
  const evidenceCapsule = accepted.find((item) => item.artifact === 'codex-evidence-capsule.safe.json')?.value;
  const decision = accepted.find((item) => item.artifact === 'codex-decision-capsule.safe.json')?.value;
  const consistency = accepted.find((item) => item.artifact === 'codex-artifact-consistency.safe.json')?.value;
  const minimal = accepted.find((item) => item.artifact === 'codex-minimal-blockers.safe.json')?.value;
  return {
    selected: accepted[0]?.artifact || 'none',
    orchestrationCapsule: orchestrationCapsule || null,
    workerProofCapsule: workerProofCapsule || null,
    ownerDecisionBrief: ownerDecisionBrief || null,
    finalDecision: finalDecision || null,
    evidenceCapsule: evidenceCapsule || null,
    decisionArtifact: decision || null,
    artifactConsistency: consistency || null,
    minimalBlockers: minimal || null,
    acceptedEvidence: accepted.map((item) => item.artifact),
    rejectedEvidence: rejected,
  };
}

export function renderSafeFailureLines(input = {}) {
  const finalDecision = input.finalDecision || {};
  const orchestration = input.orchestrationCapsule || {};
  const ownerBrief = input.ownerDecisionBrief || {};
  const decision = input.decisionArtifact || input.decisionCapsule || {};
  const consistency = input.artifactConsistency || {};
  const primaryClass = finalDecision.primaryClass || decision.primaryClass || consistency.primaryClass || input.primaryClass || 'unknown';
  const lines = [
    `decision: ${finalDecision.decision || decision.decision || input.decision || 'blocked'}`,
    `head: ${decision.head || finalDecision.head || consistency.head || input.head || 'unknown'}`,
    `primaryClass: ${primaryClass}`,
    `orchestrationMode: ${orchestration.orchestrationMode || 'unknown'}`,
    `ownerDecisionReady: ${ownerBrief.decisionReady === true ? 'true' : 'false'}`,
    `blockingArtifact: ${consistency.artifactName || decision.detailsRef || input.blockingArtifact || 'unknown'}`,
    `acceptedEvidence: ${(input.acceptedEvidence || []).slice(0, 5).join(',') || 'none'}`,
    `rejectedEvidence: ${(input.rejectedEvidence || []).slice(0, 5).join(',') || 'none'}`,
    `repairType: ${decision.repairType || consistency.repairType || input.repairType || 'unknown'}`,
    `repairTargetFile: ${input.repairTargetFile || consistency.repairTargetFile || 'unknown'}`,
    `safeNextAction: ${finalDecision.safeNextAction || decision.safeNextAction || consistency.safeNextAction || input.safeNextAction || 'owner_decision_or_state_delta'}`,
    `rawLogsRead: ${finalDecision.rawLogsRead === true || decision.rawLogsRead === true || input.rawLogsRead === true ? 'true' : 'false'}`,
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
