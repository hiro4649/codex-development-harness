#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function input(env = process.env) {
  if (env.CODEX_OPEN_PR_HYGIENE_JSON) {
    try {
      return JSON.parse(env.CODEX_OPEN_PR_HYGIENE_JSON);
    } catch {
      return { __invalid: true };
    }
  }
  if (env.CODEX_OPEN_PR_HYGIENE_PATH) {
    const parsed = readJson(env.CODEX_OPEN_PR_HYGIENE_PATH);
    if (!parsed.ok) return parsed.reasonCode === 'file_missing' ? null : { __invalid: true };
    return parsed.value;
  }
  return null;
}

function flagPr(pr) {
  const flags = [];
  if (pr.oldBaseSha || pr.needsRebase) flags.push('oldBaseSha');
  if (pr.oldHarnessVersion) flags.push('oldHarnessVersion');
  if (pr.staleEvidence) flags.push('staleEvidence');
  if (pr.staleConfirmation) flags.push('staleConfirmation');
  if (pr.overlapsCurrentHarnessFiles) flags.push('overlapsCurrentHarnessFiles');
  if (pr.touchesProductFiles) flags.push('touchesProductFiles');
  if (pr.needsOwnerDecision) flags.push('needsOwnerDecision');
  const overlapOwnerDecision = Boolean(pr.overlapsCurrentHarnessFiles && (pr.incompatibleBase || pr.staleEvidence || pr.staleConfirmation));
  const recommendation = overlapOwnerDecision || pr.needsOwnerDecision ? 'owner_decision_required' :
    flags.length ? 'refresh_required' : 'keep_open';
  return {
    prNumber: String(pr.prNumber || pr.number || '').slice(0, 20),
    flags,
    oldBaseSha: Boolean(pr.oldBaseSha),
    oldHarnessVersion: Boolean(pr.oldHarnessVersion),
    staleEvidence: Boolean(pr.staleEvidence),
    staleConfirmation: Boolean(pr.staleConfirmation),
    overlapsCurrentHarnessFiles: Boolean(pr.overlapsCurrentHarnessFiles),
    touchesProductFiles: Boolean(pr.touchesProductFiles),
    needsRebase: Boolean(pr.needsRebase),
    needsOwnerDecision: Boolean(pr.needsOwnerDecision),
    overlapOwnerDecision,
    recommendation,
    safeSummaryOnly: true,
  };
}

export function buildOpenPrHygieneReport(env = process.env) {
  const raw = input(env);
  if (!raw) return simpleStatus('openPrHygieneStatus', 'not_applicable', { reasonCodes: ['open_pr_hygiene_not_requested'] });
  if (raw.__invalid || scanObjectForUnsafe(raw).length) {
    return simpleStatus('openPrHygieneStatus', 'fail', { reasonCodes: ['open_pr_hygiene_needs_owner_decision'] });
  }
  const prs = Array.isArray(raw.pullRequests) ? raw.pullRequests : Array.isArray(raw) ? raw : [];
  const summaries = prs.map(flagPr);
  const flagged = summaries.filter((item) => item.flags.length);
  const reasonCodes = [
    ...(flagged.length ? ['open_pr_hygiene_stale_pr'] : []),
    ...(summaries.some((item) => item.needsOwnerDecision) ? ['open_pr_hygiene_needs_owner_decision'] : []),
    ...(summaries.some((item) => item.overlapOwnerDecision) ? ['open_pr_overlap_owner_decision'] : []),
  ];
  return simpleStatus('openPrHygieneStatus', reasonCodes.length ? 'warning' : 'pass', {
    reasonCodes: [...new Set(reasonCodes)],
    reportOnly: true,
    prCount: summaries.length,
    flaggedCount: flagged.length,
    recommendations: summaries,
    harnessVersion: HARNESS_VERSION,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildOpenPrHygieneReport();
    writeJsonReport(report, 'CODEX_OPEN_PR_HYGIENE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('openPrHygieneStatus', 'fail', { reasonCodes: ['open_pr_hygiene_needs_owner_decision'] });
    writeJsonReport(report, 'CODEX_OPEN_PR_HYGIENE_REPORT');
    process.exit(1);
  }
}
