#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.7

import fs from 'node:fs';

function parse(raw) {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const report = { status: 'unknown' };
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.+)$/);
      if (!match) continue;
      const [, key, value] = match;
      report[key] = value.trim();
    }
    return report;
  }
}

function readInput(filePath = '') {
  if (filePath && fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  return fs.readFileSync(0, 'utf8');
}

export function pickDecisionCapsule(report = {}) {
  return report.decisionCapsule || report.decisionCapsuleStatus?.capsule || report.codexDecisionCapsule || (report.decision ? {
    decision: report.decision,
    mergeAllowed: String(report.mergeAllowed || '').toLowerCase() === 'yes' || report.mergeAllowed === true,
    primaryClass: report.primaryClass,
    repairType: report.repairType,
    safeNextAction: report.safeNextAction,
    scopeProfile: report.scopeProfile,
    detailsRef: report.detailsRef,
  } : {});
}

export function renderDecisionCapsuleLines(report = {}) {
  const capsule = pickDecisionCapsule(report);
  const lines = [
    `decision: ${capsule.decision || report.status || 'unknown'}`,
    `mergeAllowed: ${capsule.mergeAllowed === true ? 'yes' : 'no'}`,
    `primaryClass: ${capsule.primaryClass || 'unknown'}`,
    `head: ${capsule.headSha || capsule.head || report.head || report.headSha || 'unknown'}`,
    `repairType: ${capsule.repairType || 'unknown'}`,
    `safeNextAction: ${capsule.safeNextAction || 'read_decision_capsule'}`,
    `sameHeadStatus: ${report.sameHeadStatus?.status || report.sameHeadStatus || capsule.sameHeadRequiredChecks?.state || 'unknown'}`,
    `scopeProfile: ${capsule.scopeProfile || 'unknown'}`,
    `tokenBudgetStatus: ${report.tokenBudgetStatus?.status || report.tokenBudgetStatus || 'unknown'}`,
    `detailsRef: ${capsule.detailsRef || 'codex-decision-capsule.safe.json'}`,
    `outcomeContractStatus: ${report.outcomeContractStatus?.status || 'unknown'}`,
    `artifactConsistencyStatus: ${report.artifactConsistencyStatus?.status || 'unknown'}`,
  ];
  return lines.slice(0, 20);
}

if (process.argv[1]?.endsWith('codex-read-decision-capsule.mjs')) {
  const report = parse(readInput(process.argv[2]));
  console.log(renderDecisionCapsuleLines(report).join('\n'));
}
