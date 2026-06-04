#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parse(env = process.env) {
  try {
    return env.CODEX_EVIDENCE_REPAIR_INPUT ? JSON.parse(env.CODEX_EVIDENCE_REPAIR_INPUT) : {};
  } catch {
    return { parseFailed: true };
  }
}

export function buildEvidenceAutoRepairHintReport(input = parse()) {
  const failures = [];
  const warnings = [];
  const missingField = input.missingField || '';
  const expectedFieldName = input.expectedFieldName || missingField || '';
  let safeSuggestedLine = '';
  if (expectedFieldName) {
    if (/runtimeReadinessClaimed/i.test(expectedFieldName)) safeSuggestedLine = 'Runtime readiness claimed: no';
    else if (/productCodeChanged/i.test(expectedFieldName)) safeSuggestedLine = 'Product code changed: no';
    else if (/forbidden/i.test(expectedFieldName)) safeSuggestedLine = 'Forbidden scope: product runtime code, package files, profiles/*';
    else safeSuggestedLine = `${expectedFieldName}: safe current-head value required`;
  }
  if (input.wouldWeakenGate || input.hidesNonOverridableFailure) failures.push('evidence_auto_repair_unsafe');
  if (/Runtime readiness claimed:\s*yes/i.test(safeSuggestedLine) || /Product code changed:\s*yes/i.test(safeSuggestedLine)) failures.push('evidence_auto_repair_unsafe');
  if (input.headShaExpected && input.headShaFound && input.headShaExpected !== input.headShaFound) warnings.push('headSha mismatch');
  if (input.remoteRunsPending) warnings.push('remoteRuns pending');
  if (safeSuggestedLine) warnings.push('body-only repair possible');
  const hint = {
    missingField,
    expectedFieldName,
    safeSuggestedLine,
    affectedSection: input.affectedSection || 'Task Contract',
    headShaExpected: input.headShaExpected || '',
    headShaFound: input.headShaFound || '',
    bodyOnlyRepairAllowed: Boolean(safeSuggestedLine && !failures.length),
    safeSummaryOnly: true,
  };
  const unsafe = scanObjectForUnsafe(hint).length > 0;
  return simpleStatus('evidenceAutoRepairHintStatus', failures.length || unsafe ? 'fail' : 'pass', {
    reasonCodes: [...new Set([...(unsafe ? ['evidence_auto_repair_unsafe'] : []), ...failures])],
    warnings,
    hint,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildEvidenceAutoRepairHintReport();
  writeJsonReport(report, 'CODEX_EVIDENCE_AUTO_REPAIR_HINT_REPORT');
  exitFor(report);
}
