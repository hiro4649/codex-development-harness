#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const RAW_KEYS = /candidate(Text|Output|Raw)|rawModelOutput|privatePrompt|fullDiff|token|endpoint/i;

function parse(env = process.env) {
  try {
    return env.CODEX_BEST_OF_N_DECISION_JSON ? JSON.parse(env.CODEX_BEST_OF_N_DECISION_JSON) : null;
  } catch {
    return { parseFailed: true };
  }
}

function hasRawKey(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) => RAW_KEYS.test(key) || hasRawKey(nested));
}

export function buildBestOfNDecisionReport(input = parse(), env = process.env) {
  if (!input) {
    const complexSkipped = env.CODEX_TASK_COMPLEXITY === 'high' && !env.CODEX_BEST_OF_N_SKIPPED_REASON;
    return simpleStatus('bestOfNDecisionStatus', complexSkipped ? 'warning' : 'not_applicable', {
      mode: 'not_applicable',
      reasonCodes: complexSkipped ? ['best_of_n_decision_missing'] : ['best_of_n_not_used'],
      safeSummaryOnly: true,
    });
  }
  const failures = [];
  if (input.parseFailed) failures.push('best_of_n_decision_missing');
  const mode = input.mode || (input.used ? 'used_safe_summary_only' : 'not_used_with_reason');
  if (input.used && !input.selectedReason) failures.push('best_of_n_decision_missing');
  if (hasRawKey(input) || scanObjectForUnsafe(input).length) failures.push('best_of_n_raw_candidate_forbidden');
  if (input.productOrSecurityDecision && !input.verificationDelta) failures.push('best_of_n_decision_missing');
  const record = {
    mode,
    candidateCount: Number(input.candidateCount || 0),
    selectedReason: input.selectedReason || input.notUsedReason || '',
    discardedRiskClasses: Array.isArray(input.discardedRiskClasses) ? input.discardedRiskClasses.slice(0, 20) : [],
    verificationDelta: input.verificationDelta || '',
    safeSummaryOnly: true,
  };
  return simpleStatus('bestOfNDecisionStatus', failures.length ? 'fail' : 'pass', {
    reasonCodes: [...new Set(failures)],
    record,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildBestOfNDecisionReport();
  writeJsonReport(report, 'CODEX_BEST_OF_N_DECISION_REPORT');
  exitFor(report);
}
