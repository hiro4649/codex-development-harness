#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { HARNESS_VERSION, marker, prBodyText, isPrContext, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function requiresBestOfN(body) {
  return /\bRisk level:\s*R3\b/i.test(body) ||
    /\b(ambiguous design|migration|security-sensitive|large refactor|architecture tradeoff|security|R3)\b/i.test(body);
}

function hasEvidence(body) {
  const hasBestOfNSection = /(^|\n)\s*(?:#{1,6}\s*)?Best of N Evidence\s*:?\s*$/im.test(body) ||
    /Best of N Evidence:/i.test(body);
  return /Best of N used or skipped:\s*skipped with reason/i.test(body) ||
    (hasBestOfNSection &&
      /candidate count|candidates?:/i.test(body) &&
      /selected candidate/i.test(body) &&
      /reason selected/i.test(body));
}

function buildReport(env = process.env) {
  const body = prBodyText(env);
  if (!isPrContext(env) && !body.trim()) {
    return simpleStatus('bestOfNEvidenceStatus', 'not_applicable', { reasonCodes: ['non_pr_context'] });
  }
  const required = requiresBestOfN(body);
  if (!required) return simpleStatus('bestOfNEvidenceStatus', 'not_applicable', { reasonCodes: ['best_of_n_not_required'] });
  const status = hasEvidence(body) ? 'pass' : 'fail';
  return simpleStatus('bestOfNEvidenceStatus', status, {
    reasonCodes: status === 'pass' ? [] : ['best_of_n_required'],
    required,
  });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_BEST_OF_N_EVIDENCE_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    bestOfNEvidenceStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_BEST_OF_N_EVIDENCE_REPORT');
  process.exit(1);
}
