#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readReport(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function findingKeys(report, field) {
  return new Set((report?.[field] || []).map((item) => item.fingerprint || `${item.ruleId || item.id}:${item.rootCauseId || item.path || 'general'}`));
}
function expiredCount(report, field) {
  return report?.[field]?.expired?.length || 0;
}
function diffSet(now, before) {
  return [...now].filter((item) => !before.has(item)).sort();
}
const beforePath = argValue('--before');
const afterPath = argValue('--after');
if (!beforePath || !afterPath) {
  console.log('Codex code audit compare requires --before and --after safe JSON reports.');
  process.exit(2);
}
const before = readReport(beforePath);
const after = readReport(afterPath);
const beforeBlocking = findingKeys(before, 'blockingFindings');
const afterBlocking = findingKeys(after, 'blockingFindings');
const beforeWarnings = findingKeys(before, 'warningFindings');
const afterWarnings = findingKeys(after, 'warningFindings');
const summary = {
  newBlockingFindings: diffSet(afterBlocking, beforeBlocking),
  resolvedBlockingFindings: diffSet(beforeBlocking, afterBlocking),
  newWarnings: diffSet(afterWarnings, beforeWarnings),
  resolvedWarnings: diffSet(beforeWarnings, afterWarnings),
  riskLevelChange: `${before.riskLevel || 'unknown'} -> ${after.riskLevel || 'unknown'}`,
  mergeReadyChange: `${before.mergeReady === true} -> ${after.mergeReady === true}`,
  humanReviewRequiredChange: `${before.humanReviewRequired === true} -> ${after.humanReviewRequired === true}`,
  knownRiskExpiryChange: `${expiredCount(before, 'knownRisks')} -> ${expiredCount(after, 'knownRisks')}`,
  suppressionExpiryChange: `${expiredCount(before, 'codeAuditBaseline')} -> ${expiredCount(after, 'codeAuditBaseline')}`,
  decisionMatrixChange: `${before.decisionMatrix?.status || 'unknown'} -> ${after.decisionMatrix?.status || 'unknown'}`,
};
console.log('== Codex code audit compare ==');
for (const [key, value] of Object.entries(summary)) {
  if (Array.isArray(value)) console.log(`${key}: ${value.length}`);
  else console.log(`${key}: ${value}`);
}
