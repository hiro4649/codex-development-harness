#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { HARNESS_VERSION, marker, prBodyText, isPrContext, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function docsOnly(body) {
  return /\b(docs-only|policy-only|documentation only|harness-only)\b/i.test(body) &&
    !/\bbug fix|behavior change|refactor|migration|implementation change\b/i.test(body);
}

function requiresTestEvidence(body) {
  return /\bbug fix|behavior change|refactor|migration|implementation change|changed behavior\b/i.test(body) && !docsOnly(body);
}

function hasTestEvidence(body) {
  const hasSection = /(^|\n)\s*(?:#{1,6}\s*)?Test Coverage Evidence\s*:?\s*$/im.test(body) ||
    /Test Coverage Evidence:/i.test(body);
  return hasSection &&
    /changed area/i.test(body) &&
    /test command/i.test(body) &&
    /what the test covers/i.test(body) &&
    /edge cases|failure paths|reason if no test/i.test(body);
}

function buildReport(env = process.env) {
  const body = prBodyText(env);
  if (!isPrContext(env) && !body.trim()) {
    return simpleStatus('testCoverageEvidenceStatus', 'not_applicable', { reasonCodes: ['non_pr_context'] });
  }
  if (!requiresTestEvidence(body)) {
    return simpleStatus('testCoverageEvidenceStatus', 'not_applicable', { reasonCodes: ['test_coverage_not_required'] });
  }
  const status = hasTestEvidence(body) ? 'pass' : 'fail';
  return simpleStatus('testCoverageEvidenceStatus', status, {
    reasonCodes: status === 'pass' ? [] : ['test_coverage_evidence_missing'],
  });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_TEST_COVERAGE_EVIDENCE_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    testCoverageEvidenceStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_TEST_COVERAGE_EVIDENCE_REPORT');
  process.exit(1);
}
