#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.5

import fs from 'node:fs';
import { pickSafeSummary } from './codex-v112-conversation-surface.mjs';

const filePath = process.argv[2] || '';
const rawInput = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
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
const report = parseReport(rawInput);
const base = pickSafeSummary(report, { safeArtifactPath: filePath });
const decisionCore = report.decisionCore || report.decisionCoreV2Status?.decision || {};
const top3 = report.top3Blockers || {};
const summary = {
  status: report.status || base.status || 'unknown',
  qualityScore: base.qualityScore ?? report.qualityScore ?? null,
  decisionCore: {
    decision: decisionCore.decision || report.status || 'unknown',
    primaryClass: decisionCore.primaryClass || top3.primary_blocker || 'none',
    mergeAllowed: decisionCore.mergeAllowed === true,
    safeNextAction: decisionCore.safeNextAction || top3.safe_next_action || 'read_decision_core',
  },
  top3Blockers: {
    primary: top3.primary_blocker || base.topBlockingReasonCodes?.[0] || 'none',
    secondary: top3.secondary_blocker || base.topBlockingReasonCodes?.[1] || 'none',
    tertiary: top3.tertiary_blocker || base.topBlockingReasonCodes?.[2] || 'none',
  },
  traceId: report.traceId || decisionCore.traceId || '',
  skillProfile: report.skillProfile || '',
  permissionProfile: report.permissionProfile || '',
  tokenCostSummary: report.tokenCostSummary || report.tokenRuntimeMeterStatus?.meter || {},
  artifactPointer: decisionCore.evidenceSource || report.safeArtifactIndexStatus?.artifactPointer || (filePath ? 'safe-summary-input' : ''),
  passStatusCount: base.passStatusCount || 0,
  passStatusesListed: false,
  legacyDetailSuppressed: true,
  longForbiddenTextSuppressed: true,
  completedTargetDetailsSuppressed: true,
  safeSummaryOnly: true,
};
console.log(JSON.stringify(summary, null, 2));
