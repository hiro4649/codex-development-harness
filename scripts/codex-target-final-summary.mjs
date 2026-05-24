#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.4
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function buildFinalSummary(report = {}, mode = report.targetQualityScoreStatus ? 'target' : 'source') {
  const summary = {
    schemaVersion: '0.8.3',
    harnessVersion: HARNESS_VERSION,
    repo: report.repository || process.env.CODEX_REPOSITORY || '',
    mode,
    headSha: report.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || '',
    targetQualityScore: report.targetQualityScoreStatus?.score ?? null,
    sourceQualityScore: report.qualityScoreStatus?.score ?? null,
    agentsContext: report.agentsContextStatus?.status || 'missing',
    changeClassification: report.changeClassificationStatus?.status || 'missing',
    productVerification: report.productVerificationStatus?.status || 'missing',
    baselineStatus: report.remoteProductBaselineStatus?.status || 'not_applicable',
    npmDiagnostic: report.remoteNpmDiagnosticStatus?.status || 'not_applicable',
    stalePrAudit: report.stalePrAuditStatus?.status || 'not_applicable',
    reasonSummary: report.reasonSummary?.status || report.reasonSummaryStatus?.status || 'missing',
    runtimeReadinessClaimed: Boolean(report.changeClassificationStatus?.runtimeReadinessClaimed),
    productFilesChanged: Boolean(report.changeClassificationStatus?.productRelevantChanged),
    packageFilesChanged: Boolean(report.changeClassificationStatus?.packageOrLockfileChanged),
    mergeReadiness: report.targetMergeReady ?? report.mergeReady ?? false,
    topNextAction: report.reasonSummary?.topNextActions?.[0] || report.reasonSummaryStatus?.summary?.topNextActions?.[0] || '',
    safeSummaryOnly: true,
  };
  return {
    status: scanObjectForUnsafe(summary).length ? 'fail' : 'pass',
    reasonCodes: scanObjectForUnsafe(summary).length ? ['target_final_summary_invalid'] : [],
    summary,
  };
}

export function buildFinalSummaryReport(env = process.env) {
  const file = env.CODEX_FINAL_SUMMARY_REPORT_PATH || env.CODEX_WORKFLOW_REPORT_PATH || process.argv[2];
  if (!file) return simpleStatus('targetFinalSummaryStatus', 'not_applicable', { reasonCodes: ['final_summary_not_requested'] });
  const parsed = readJson(file);
  if (!parsed.ok) return simpleStatus('targetFinalSummaryStatus', 'fail', { reasonCodes: ['target_final_summary_invalid'] });
  const built = buildFinalSummary(parsed.value);
  return simpleStatus('targetFinalSummaryStatus', built.status, {
    reasonCodes: built.reasonCodes,
    summary: built.summary,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildFinalSummaryReport();
    if (process.argv.includes('--write-artifact') && report.targetFinalSummaryStatus.summary) {
      const mode = report.targetFinalSummaryStatus.summary.mode === 'target' ? 'target' : 'source';
      fs.writeFileSync(`codex-${mode}-final-summary.json`, JSON.stringify(report.targetFinalSummaryStatus.summary, null, 2));
    }
    writeJsonReport(report, 'CODEX_TARGET_FINAL_SUMMARY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('targetFinalSummaryStatus', 'fail', { reasonCodes: ['target_final_summary_invalid'] });
    writeJsonReport(report, 'CODEX_TARGET_FINAL_SUMMARY_REPORT');
    process.exit(1);
  }
}
