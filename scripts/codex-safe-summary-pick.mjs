#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.8

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pickSafeSummary } from './codex-v112-conversation-surface.mjs';

function parseReport(raw) {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const report = { status: 'unknown', safeSummaryOnly: true };
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.+)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (key.endsWith('Status')) report[key] = { status: value.trim(), safeSummaryOnly: true };
      else if (key === 'qualityScore') report.qualityScore = Number(value.trim());
      else report[key] = value.trim();
    }
    if (typeof report.status !== 'string') report.status = report.status?.status || 'unknown';
    return report;
  }
}
function inferSafeDetailDecision(report = {}) {
  const reasonCodes = [
    ...(Array.isArray(report.reasonCodes) ? report.reasonCodes : []),
    ...(Array.isArray(report.lastKnownReasonCodes) ? report.lastKnownReasonCodes : []),
  ].filter(Boolean);
  const lacksSafeDetail = (report.status === 'fail' || report.status === 'unknown')
    && reasonCodes.length === 0
    && !report.decisionCore
    && !report.decisionCoreV2Status?.decision
    && !report.minimalBlockers
    && !report.top3Blockers;
  if (!lacksSafeDetail) return {};
  return {
    decision: 'blocked',
    primaryClass: 'safe_detail_unavailable',
    mergeAllowed: false,
    productRepairAllowed: false,
    harnessRepairAllowed: true,
    safeNextAction: 'owner_decision_for_source_compatibility_repair',
    evidenceSource: 'codex-minimal-safe-failure.json',
    traceId: 'trace-safe-detail-unavailable',
    safeSummaryOnly: true,
  };
}

export function summarizeSafeReport(report = {}, safeArtifactPath = '') {
  const base = pickSafeSummary(report, { safeArtifactPath });
  const finalDecision = report.finalDecision || report.finalDecisionStatus?.finalDecision || {};
  const evidenceCapsule = report.evidenceCapsule || report.evidenceCapsuleStatus?.evidenceCapsule || {};
  const capsule = report.decisionCapsule || report.decisionCapsuleStatus?.capsule || (report.decision ? {
    decision: report.decision,
    mergeAllowed: String(report.mergeAllowed || '').toLowerCase() === 'yes' || report.mergeAllowed === true,
    primaryClass: report.primaryClass,
    primaryBlocker: report.primaryBlocker || report.primaryClass,
    repairType: report.repairType,
    safeNextAction: report.safeNextAction,
    detailsRef: report.detailsRef,
  } : {});
  const artifactConsistency = report.artifactConsistency || report.artifactConsistencyStatus?.artifactConsistency || {};
  const decisionCore = capsule.decision
    ? {
      decision: capsule.decision,
      primaryClass: capsule.primaryClass,
      mergeAllowed: capsule.mergeAllowed,
      productRepairAllowed: capsule.productRepairAllowed,
      harnessRepairAllowed: capsule.harnessRepairAllowed,
      safeNextAction: capsule.safeNextAction,
      evidenceSource: capsule.detailsRef,
      traceId: capsule.headSha,
    }
    : (report.decisionCore || report.decisionCoreV2Status?.decision || inferSafeDetailDecision(report));
  const top3 = report.top3Blockers || report.minimalBlockers || {};
  return {
    status: report.status || base.status || 'unknown',
    qualityScore: base.qualityScore ?? report.qualityScore ?? null,
    decisionCore: {
      decision: finalDecision.decision || decisionCore.decision || report.status || 'unknown',
      primaryClass: finalDecision.primaryClass || decisionCore.primaryClass || top3.primary_blocker || 'none',
      mergeAllowed: finalDecision.mergeAllowed === true || decisionCore.mergeAllowed === true,
      productRepairAllowed: decisionCore.productRepairAllowed === true,
      harnessRepairAllowed: decisionCore.harnessRepairAllowed === true,
      safeNextAction: decisionCore.safeNextAction || top3.safe_next_action || 'read_decision_core',
    },
    top3Blockers: {
      primary: top3.primary_blocker || decisionCore.primaryClass || base.topBlockingReasonCodes?.[0] || 'none',
      secondary: top3.secondary_blocker || base.topBlockingReasonCodes?.[1] || 'none',
      tertiary: top3.tertiary_blocker || base.topBlockingReasonCodes?.[2] || 'none',
    },
    traceId: report.traceId || decisionCore.traceId || '',
    skillProfile: report.skillProfile || '',
    permissionProfile: report.permissionProfile || '',
    tokenCostSummary: report.tokenCostSummary || report.tokenRuntimeMeterStatus?.meter || {},
    finalDecision,
    evidenceCapsule,
    decisionCapsule: capsule,
    finalDecisionStatus: report.finalDecisionStatus?.status || 'unknown',
    evidenceCapsuleStatus: report.evidenceCapsuleStatus?.status || 'unknown',
    convergenceGateStatus: report.convergenceGateStatus?.status || 'unknown',
    scopeBoundaryStatus: report.scopeBoundaryStatus?.status || 'unknown',
    outcomeContractStatus: report.outcomeContractStatus?.status || 'unknown',
    verifierCapsuleStatus: report.verifierCapsuleStatus?.status || 'unknown',
    artifactConsistencyStatus: report.artifactConsistencyStatus?.status || 'unknown',
    safeFailureReaderStatus: report.safeFailureReaderStatus?.status || 'unknown',
    primaryBlocker: capsule.primaryBlocker || top3.primary_blocker || decisionCore.primaryClass || 'none',
    repairType: capsule.repairType || 'external_confirmation_required',
    sameHeadStatus: report.sameHeadStatus?.status || 'unknown',
    tokenBudgetStatus: report.tokenBudgetStatus?.status || 'unknown',
    detailsRef: capsule.detailsRef || decisionCore.evidenceSource || 'codex-decision-capsule.safe.json',
    artifactPointer: capsule.detailsRef || artifactConsistency.firstReadArtifact || decisionCore.evidenceSource || report.safeArtifactIndexStatus?.artifactPointer || (safeArtifactPath ? 'safe-summary-input' : ''),
    passStatusCount: base.passStatusCount || 0,
    passStatusesListed: false,
    legacyDetailSuppressed: true,
    longForbiddenTextSuppressed: true,
    completedTargetDetailsSuppressed: true,
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const filePath = process.argv[2] || '';
  const rawInput = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const report = parseReport(rawInput);
  const summary = summarizeSafeReport(report, filePath);
  console.log(JSON.stringify(summary, null, 2));
}
