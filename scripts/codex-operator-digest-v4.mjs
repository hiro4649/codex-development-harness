#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { buildStatus } from './codex-status-taxonomy.mjs';

const REQUIRED_LABELS = [
  'Current state:',
  'Hard blocker:',
  'Allowed now:',
  'Forbidden now:',
  'One safe next action:',
];

export function buildOperatorDigestV4(input = {}) {
  return [
    `Current state: ${input.currentState || 'source harness v1.0.9 candidate'}`,
    `Hard blocker: ${input.hardBlocker || 'none'}`,
    `Allowed now: ${input.allowedNow || 'source harness validation only'}`,
    `Forbidden now: ${input.forbiddenNow || 'target rollout, runtime, production readiness'}`,
    `One safe next action: ${input.oneSafeNextAction || 'verify source harness checks'}`,
  ].join('\n');
}

export function validateOperatorDigestV4(text) {
  const lines = String(text || '').split(/\r?\n/);
  const labelsOk = REQUIRED_LABELS.every((label, index) => lines[index]?.startsWith(label));
  return { status: lines.length === 5 && labelsOk ? 'pass' : 'fail', lineCount: lines.length, safeSummaryOnly: true };
}

export function buildOperatorDigestV4Status(input = {}) {
  const digest = buildOperatorDigestV4(input);
  const validation = validateOperatorDigestV4(digest);
  return {
    ...buildStatus('operatorDigestV4Status', validation.status, { reasonCodes: validation.status === 'pass' ? [] : ['operator_digest_v4_shape_invalid'], safeSummary: { lineCount: validation.lineCount } }),
    ...buildStatus('mergeCriticalSummaryStatus', 'pass', { reasonCodes: ['merge_critical_summary_artifact_only'], safeSummary: { humanDigestLines: 5 } }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(buildOperatorDigestV4());
}
