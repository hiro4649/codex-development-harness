#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, parseArgs, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildInvalidReportRecoverySummary } from './codex-invalid-report-recovery.mjs';

function reasonCatalog() {
  const parsed = readJson('docs/process/CODEX_FAILURE_REASON_CATALOG.json');
  return parsed.ok ? new Set((parsed.value.reasonCodes || []).map((item) => item.reasonCode)) : new Set();
}

function scoreFor(report, mode) {
  const status = mode === 'target' ? report.targetQualityScoreStatus : report.qualityScoreStatus;
  return typeof status?.score === 'number' ? status.score : null;
}

function statusItems(report) {
  return Object.entries(report || {}).filter(([key, value]) =>
    (key.endsWith('Status') || key === 'secretScan' || key === 'safeArtifactValidation') &&
    value && typeof value === 'object');
}

function safeReasonCode(key, status) {
  if (status === 'manual_confirmation_required') return 'missing_human_confirmation';
  if (status === 'warning') return 'workflow_required_status_failure';
  if (status === 'not_applicable') return 'safe_artifact_missing';
  return `${key}_failed`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
}

export function buildDiagnosticConsolidatedSummary(report, options = {}) {
  const mode = report?.targetQualityScoreStatus && !report?.sourceHarnessValidationStatus ? 'target' : 'source';
  const catalog = reasonCatalog();
  const blocking = [];
  const manual = [];
  const optional = [];
  for (const [key, value] of statusItems(report)) {
    const status = value.status || 'missing';
    const reasonCodes = Array.isArray(value.reasonCodes) && value.reasonCodes.length ? value.reasonCodes : [safeReasonCode(key, status)];
    const entry = { gate: key, status, reasonCodes: reasonCodes.slice(0, 5) };
    if (['fail', 'missing', 'not_run'].includes(status)) blocking.push(entry);
    else if (['manual_confirmation_required', 'warning'].includes(status)) manual.push(entry);
    else if (status === 'not_applicable') optional.push(entry);
  }
  const summary = {
    schemaVersion: '0.8.4',
    harnessVersion: HARNESS_VERSION,
    mode,
    score: scoreFor(report, mode),
    pathMode: report?.fastPathStatus?.pathMode || 'full_product_path',
    blockingReasons: blocking.slice(0, 10),
    manualReasons: manual.slice(0, 10),
    optionalReasons: optional.slice(0, 10),
    unsafeValueClasses: report?.safeOutputScanStatus?.unsafeClasses || [],
    invalidReportSummary: options.invalidReportSummary || null,
    baselineSummary: report?.remoteProductBaselineStatus ? { status: report.remoteProductBaselineStatus.status } : null,
    npmDiagnosticSummary: report?.remoteNpmDiagnosticStatus ? { status: report.remoteNpmDiagnosticStatus.status } : null,
    stalePrSummary: report?.stalePrAuditStatus ? { status: report.stalePrAuditStatus.status } : null,
    artifactIndexSummary: report?.safeArtifactIndexStatus ? { status: report.safeArtifactIndexStatus.status } : null,
    v093Summary: {
      previousTargetHotfixPreservation: report?.previousTargetHotfixPreservationStatus?.status || 'missing',
      targetPatchManifest: report?.targetPatchManifestStatus?.status || 'missing',
      targetRolloutConflict: report?.targetRolloutConflictStatus?.status || 'missing',
      remoteProductPrContextFixture: report?.remoteProductPrContextFixtureStatus?.status || 'missing',
      targetScriptClassificationFixture: report?.targetScriptClassificationFixtureStatus?.status || 'missing',
      sameHeadArtifactEvidence: report?.sameHeadArtifactEvidenceStatus?.status || 'missing',
      dockerSmokeCurrentHeadArtifact: report?.dockerSmokeCurrentHeadArtifactStatus?.status || 'missing',
      targetSkipNpmProductOverride: report?.targetSkipNpmProductOverrideStatus?.status || 'missing',
      goalCondition: report?.goalConditionStatus?.status || 'missing',
      reviewPolicyClassifier: report?.reviewPolicyClassifierStatus?.status || 'missing',
      prEvidenceCompact: report?.prEvidenceCompactStatus?.status || 'missing',
      v093SelfTest: report?.v093SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v092Summary: {
      versionLineage: report?.versionLineageStatus?.status || 'missing',
      prEvidenceRenderer: report?.prEvidenceRendererStatus?.status || 'missing',
      safeArtifactClassifier: report?.safeArtifactClassifierStatus?.status || 'missing',
      securityLifecycle: report?.securityLifecycleStatus?.status || 'missing',
      reviewIndependence: report?.reviewIndependenceStatus?.status || 'missing',
      taskBriefCompiler: report?.taskBriefCompilerStatus?.status || 'missing',
      bestOfNDecision: report?.bestOfNDecisionStatus?.status || 'missing',
      environmentProfile: report?.environmentProfileStatus?.status || 'missing',
      agentsContextBudget: report?.agentsContextBudgetStatus?.status || 'missing',
      evidenceAutoRepairHint: report?.evidenceAutoRepairHintStatus?.status || 'missing',
      v092SelfTest: report?.v092SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v085Summary: report?.v085StabilityStatus ? {
      status: report.v085StabilityStatus.status,
      taskDiscipline: report.v085StabilityStatus.taskDisciplineStatus?.status || 'missing',
      bugfixEvidence: report.v085StabilityStatus.bugfixEvidenceStatus?.status || 'missing',
      fastPathDecision: report.v085StabilityStatus.fastPathExplainabilityStatus?.decision || '',
    } : null,
    codeReviewMonitorSummary: report?.codeReviewMonitorStatus ? {
      status: report.codeReviewMonitorStatus.status,
      reviewProfile: report.codeReviewMonitorStatus.reviewProfile || 'unknown',
      blockingCount: Array.isArray(report.codeReviewMonitorStatus.blockingFindings) ? report.codeReviewMonitorStatus.blockingFindings.length : 0,
      manualCount: Array.isArray(report.codeReviewMonitorStatus.manualFindings) ? report.codeReviewMonitorStatus.manualFindings.length : 0,
      warningCount: Array.isArray(report.codeReviewMonitorStatus.warnings) ? report.codeReviewMonitorStatus.warnings.length : 0,
      safeSummaryOnly: true,
    } : null,
    governanceSummary: {
      prompt: report?.promptGovernanceStatus?.status || 'missing',
      knowledge: report?.knowledgeGovernanceStatus?.status || 'missing',
      contract: report?.contractGovernanceStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    oneScreenDashboard: report?.v085StabilityStatus?.oneScreenDashboardStatus || null,
    nextActions: (blocking.length ? ['fix_blocking_gate'] : manual.length ? ['provide_current_head_confirmation'] : ['ready_for_review']).slice(0, 5),
    safeSummaryOnly: true,
  };
  const reasonCodes = [...new Set([
    ...blocking.flatMap((item) => item.reasonCodes),
    ...manual.flatMap((item) => item.reasonCodes),
  ])].filter((code) => !catalog.size || catalog.has(code) || code.endsWith('_failed'));
  const invalidReasonCodes = [...new Set([
    ...blocking.flatMap((item) => item.reasonCodes),
    ...manual.flatMap((item) => item.reasonCodes),
  ])].filter((code) => catalog.size && !catalog.has(code) && !code.endsWith('_failed'));
  const unsafe = scanObjectForUnsafe(summary).length > 0;
  return {
    summary,
    status: unsafe || invalidReasonCodes.length ? 'fail' : 'pass',
    reasonCodes: [
      ...(unsafe ? ['diagnostic_consolidation_invalid'] : []),
      ...(invalidReasonCodes.length ? ['diagnostic_consolidation_invalid'] : []),
      ...reasonCodes.slice(0, 10),
    ],
  };
}

export function buildDiagnosticConsolidationReport(input = null, options = {}) {
  if (!input || typeof input !== 'object') {
    const invalidReportSummary = buildInvalidReportRecoverySummary({
      reportPresent: Boolean(options.reportPresent),
      jsonParseStatus: 'fail',
      fallbackArtifactsWritten: true,
    });
    const consolidated = buildDiagnosticConsolidatedSummary({
      status: 'fail',
      fastPathStatus: { status: 'fail', pathMode: 'full_product_path' },
      workflowQualityRunnerStatus: { status: 'fail', reasonCodes: ['workflow_runner_invalid_report'] },
    }, { invalidReportSummary });
    return simpleStatus('diagnosticConsolidationStatus', 'fail', {
      reasonCodes: ['diagnostic_consolidation_invalid'],
      summary: consolidated.summary,
    });
  }
  const consolidated = buildDiagnosticConsolidatedSummary(input, options);
  return simpleStatus('diagnosticConsolidationStatus', consolidated.status, {
    reasonCodes: consolidated.status === 'pass' ? [] : consolidated.reasonCodes,
    summary: consolidated.summary,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = parseArgs();
    let input = null;
    if (args.report) {
      try {
        input = JSON.parse(fs.readFileSync(args.report, 'utf8'));
      } catch {
        input = null;
      }
    } else if (process.env.CODEX_DIAGNOSTIC_REPORT_JSON) {
      input = JSON.parse(process.env.CODEX_DIAGNOSTIC_REPORT_JSON);
    } else {
      input = { status: 'pass', qualityScoreStatus: { status: 'pass', score: 100 }, fastPathStatus: { status: 'pass', pathMode: 'source_harness_fast_path' } };
    }
    const report = buildDiagnosticConsolidationReport(input, { reportPresent: Boolean(args.report) });
    if (args.out || process.argv.includes('--write-artifact')) {
      fs.writeFileSync(args.out || 'codex-diagnostic-consolidated-summary.json', JSON.stringify(report.diagnosticConsolidationStatus.summary, null, 2));
    }
    writeJsonReport(report, 'CODEX_DIAGNOSTIC_CONSOLIDATION_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('diagnosticConsolidationStatus', 'fail', { reasonCodes: ['diagnostic_consolidation_invalid'] });
    writeJsonReport(report, 'CODEX_DIAGNOSTIC_CONSOLIDATION_REPORT');
    process.exit(1);
  }
}
