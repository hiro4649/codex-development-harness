#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  evidenceFacts,
  readPrBody,
  unsafeLabels,
  weakEvidenceLineLabels,
} from './codex-production-readiness-gate.mjs';
import { buildEvidencePackReport, isStructuredEvidencePackSource } from './codex-evidence-pack-validate.mjs';

function readOptionalJson(file) {
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function weakEvidenceLabels(body) {
  const lower = body.toLowerCase();
  const labels = weakEvidenceLineLabels(body);
  if (/\bskip|skipped\b/.test(lower) && !/\breason\b|\bbecause\b|\bnot applicable with reason\b|\bseparate follow up\b/.test(lower)) {
    labels.push('skipped_check_without_reason');
  }
  return labels;
}

function qualityReportLabels(report) {
  if (!report || typeof report !== 'object') return [];
  const labels = [];
  const required = ['status', 'mergeReady'];
  for (const key of required) {
    if (!(key in report)) labels.push(`quality_report_${key}_missing`);
  }
  const raw = JSON.stringify(report);
  if (unsafeLabels('qualityReport', raw).length) labels.push('quality_report_unsafe_shape');
  return labels;
}

function buildEvidenceIntegrityReport(env = process.env) {
  const evidencePack = buildEvidencePackReport(env).evidencePackStatus;
  if (isStructuredEvidencePackSource(evidencePack?.source)) {
    const status = evidencePack.status;
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      evidenceIntegrityStatus: {
        status,
        labels: ['structured_evidence_pack_preferred'],
        failures: status === 'fail' ? (evidencePack.reasonCodes || ['evidence_pack_invalid']) : [],
        warnings: evidencePack.warnings || [],
        requiredEvidenceFields: {
          evidencePack: 'present',
          headShaStatus: (evidencePack.reasonCodes || []).includes('head_sha_mismatch') ? 'stale' : 'present',
        },
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status,
      safeSummary: status === 'pass'
        ? 'Evidence integrity gate passed using structured evidence pack.'
        : 'Evidence integrity gate failed; see safe labels only.',
    };
  }
  const bodyInfo = readPrBody(env);
  const body = bodyInfo.body || '';
  const failures = [];
  const warnings = [];
  const labels = [];

  failures.push(...unsafeLabels('evidenceInput', body));

  if (bodyInfo.prContext && !body.trim()) failures.push('pr_body_missing');
  if (!bodyInfo.prContext && !body.trim()) {
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      evidenceIntegrityStatus: {
        status: 'not_applicable',
        labels: ['non_pr_no_evidence_claim'],
        failures,
        warnings,
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'not_applicable',
      safeSummary: 'Evidence integrity gate is not applicable for non-PR execution without evidence claims.',
    };
  }

  const facts = evidenceFacts(body, env);
  labels.push(...weakEvidenceLabels(body));

  if (facts.command && !facts.result) failures.push('command_without_result');
  if (facts.result && !facts.command) failures.push('result_without_command');
  if (facts.risky || facts.productionClaim) {
    if (!facts.dated) failures.push('date_or_timestamp_missing_for_risky_evidence');
    if (!facts.headKnown) failures.push('head_sha_missing_for_pr_readiness_evidence');
    if (!facts.source) failures.push('evidence_source_missing');
    if (!facts.residual) failures.push('residual_risks_missing');
  }
  if (facts.staleHead) failures.push('stale_evidence_used_as_current');
  if (!facts.reasonedSkip) failures.push('skipped_check_reason_missing');
  if (labels.length && (facts.productionClaim || facts.risky)) failures.push('weak_evidence_used_as_pass');

  if (/github actions[\s\S]{0,120}\bpass\b/i.test(body) && !/\bsource\s*[:=]\s*(ci|github actions)\b/i.test(body)) {
    failures.push('github_actions_pass_not_verifiable');
  }

  const reportPath = env.CODEX_QUALITY_REPORT_PATH || env.CODEX_LOCAL_QUALITY_REPORT_PATH || '';
  const evidencePackPath = env.CODEX_EVIDENCE_PACK_PATH || '';
  const qualityLabels = qualityReportLabels(readOptionalJson(reportPath));
  failures.push(...qualityLabels);
  if (evidencePackPath && unsafeLabels('evidencePackPath', evidencePackPath).length) {
    failures.push('evidence_pack_path_unsafe');
  }

  const status = failures.length ? 'fail' : warnings.length ? 'manual_confirmation_required' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    evidenceIntegrityStatus: {
      status,
      labels,
      failures,
      warnings,
      requiredEvidenceFields: {
        command: facts.command,
        result: facts.result,
        dateOrTimestamp: facts.dated,
        source: facts.source,
        headShaStatus: facts.staleHead ? 'stale' : facts.headKnown ? 'present' : 'missing',
        skippedChecksHaveReason: facts.reasonedSkip,
        residualRisks: facts.residual,
        remoteQualityGateEvidence: facts.remote,
        qualityReportPathProvided: Boolean(reportPath),
        evidencePackPathProvided: Boolean(evidencePackPath),
      },
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status,
    safeSummary: status === 'pass'
      ? 'Evidence integrity gate passed.'
      : status === 'manual_confirmation_required'
        ? 'Evidence integrity gate requires manual confirmation for safe labels.'
        : 'Evidence integrity gate failed; see safe labels only.',
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_EVIDENCE_INTEGRITY_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`evidenceIntegrityStatus: ${report.evidenceIntegrityStatus.status}`);
    console.log(report.safeSummary);
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

export { buildEvidenceIntegrityReport };

if (isMain()) {
  try {
    const report = buildEvidenceIntegrityReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      evidenceIntegrityStatus: {
        status: 'fail',
        labels: ['unexpected_error'],
        failures: ['evidence_integrity_gate_unexpected_error'],
        warnings: [],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'fail',
      safeSummary: 'Evidence integrity gate failed with an internal error.',
    };
    printReport(report);
    process.exit(1);
  }
}
