#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEvidencePackReport, isStructuredEvidencePackSource } from './codex-evidence-pack-validate.mjs';

export const HARNESS_VERSION = '1.0.1';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
export const forbiddenOutputKeys = [
  'rawDiff',
  'rawLogs',
  'secretValue',
  'endpointValue',
  'privatePath',
  'payload',
  'productionData',
  'personalData',
];
export const nonOverridableFailures = [
  'secretScanFailure',
  'blockedPaths',
  'highConfidenceSecret',
  'implementationHarnessMixing',
  'profileRequiredFailure',
  'openaiMethodGateFailure',
];

export function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

export function gitHeadSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

export function readPrBody(env = process.env) {
  if (env.CODEX_PR_BODY && env.CODEX_PR_BODY.trim()) {
    return { body: env.CODEX_PR_BODY, prContext: true, source: 'CODEX_PR_BODY' };
  }
  if (env.CODEX_PR_BODY_PATH) {
    const body = readText(env.CODEX_PR_BODY_PATH);
    if (body !== null) return { body, prContext: true, source: 'CODEX_PR_BODY_PATH' };
  }
  if (env.GITHUB_EVENT_PATH) {
    const text = readText(env.GITHUB_EVENT_PATH);
    if (text) {
      try {
        const event = JSON.parse(text);
        if (event.pull_request) {
          return { body: event.pull_request.body || '', prContext: true, source: 'GITHUB_EVENT_PATH' };
        }
      } catch {
        return { body: '', prContext: true, source: 'GITHUB_EVENT_PATH', eventReadError: true };
      }
    }
  }
  const prContext = env.CODEX_EVENT_NAME === 'pull_request' ||
    Boolean(env.CODEX_PR_NUMBER) ||
    Boolean(env.GITHUB_REF && env.GITHUB_REF.includes('/pull/'));
  return { body: '', prContext, source: 'none' };
}

export function unsafeLabels(label, text) {
  const value = String(text || '');
  const findings = [];
  const rules = [
    ['unsafe_raw_diff_like', /^diff --git\s|^@@\s/m],
    ['unsafe_private_key_like', /-----BEGIN [^-]+PRIVATE KEY-----/i],
    ['unsafe_token_like', /\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/],
    ['unsafe_jwt_like', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['unsafe_private_location_like', /\b[A-Za-z]:\\Users\\[^"'`\s]+|\/home\/[^"'`\s]+/i],
    ['unsafe_endpoint_like', /\b(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s<>"'`]+/i],
  ];
  for (const [name, pattern] of rules) {
    if (pattern.test(value)) findings.push(`${label}:${name}`);
  }
  for (const key of forbiddenOutputKeys) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(value)) findings.push(`${label}:unsafe_output_key`);
  }
  return [...new Set(findings)];
}

export function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[`*_#[\](){}-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripListMarker(line) {
  return String(line || '').replace(/^\s*[-*]\s+/, '').trim();
}

export function weakEvidenceLineLabels(body) {
  const labels = [];
  const lines = String(body || '').split(/\r?\n/).map(stripListMarker).filter(Boolean);
  const weakValue = '(passed only|looks good|verified|done|n/a|na|tbd|todo|not run)';
  for (const line of lines) {
    const lower = line.toLowerCase().trim().replace(/\s+/g, ' ');
    if (new RegExp(`^${weakValue}\\.?$`).test(lower)) labels.push('weak_evidence_value_only');
    if (new RegExp(`^(commands run|verification results|remote quality[- ]gate result|testing and review|result)\\s*:\\s*${weakValue}\\.?$`).test(lower)) {
      labels.push('weak_evidence_field_value');
    }
  }
  return [...new Set(labels)];
}

export function hasProductionClaim(body) {
  const lower = normalizeText(body);
  const rawLower = String(body || '').toLowerCase();
  const explicitReadyClaim = /\bproduction ready\b|\brelease ready\b|\bmerge ready\b|\bship ready\b/.test(lower);
  const legacyLocalizedClaim = /\b隴幢�E��E�騾�E�・�E�E・�E�陷�E�・�E�E・�E�\b|\b陷・・�E�・�E�髣匁E���E�陷�E�・�E�E・�E�\b/.test(lower);
  const explicitGoDecision = /\bgo\s*(?:\/|-|\s+)\s*no\s*(?:\/|-|\s+)\s*go\s*:\s*(?:go|yes|approved|pass)\b/i.test(rawLower) ||
    /\bgo\s+(?:decision|status|conclusion)\s*:\s*(?:go|yes|approved|pass)\b/i.test(rawLower);
  return explicitReadyClaim || legacyLocalizedClaim || explicitGoDecision;
}

export function isRiskyContext(body) {
  const lower = normalizeText(body);
  return /\br3\b|\brelease\b|\bsecurity\b|\bproduction\b|\bmigration\b|\bdependency\b|\bmulti file\b|\blarge diff\b|\bimplementation\b/.test(lower);
}

export function hasWeakEvidenceWords(body) {
  return weakEvidenceLineLabels(body).length > 0;
}

export function hasReasonedSkip(body) {
  const lower = normalizeText(body);
  if (!/\bskip|skipped|not run\b/.test(lower)) return true;
  return /\breason\b|\bbecause\b|\bnot applicable with reason\b|\bseparate follow up\b/.test(lower);
}

function humanReviewDecisionPresent(body) {
  return confirmationRequirement(body) !== 'missing' ||
    /\bhuman review\s*:\s*(yes|required|no|not required with reason)\b/i.test(body);
}

export function evidenceFacts(body, env = process.env) {
  const lower = normalizeText(body);
  const command = /\bcommands run\b|\bcommand\b|\bnode scripts\//i.test(body);
  const result = /\bpass\b|\bfail\b|\bexit code\b|\bexit 0\b|\bsuccess\b/i.test(body);
  const dated = /\b20[0-9]{2}-[0-9]{2}-[0-9]{2}\b|\btimestamp\b|\bdate\b/i.test(body);
  const source = /\blocal\b|\bci\b|\bgithub actions\b|\bmanual\b/i.test(body);
  const rollback = /\brollback\b|\bmerge after verify\b|\bmerge-after verify\b|\bstop condition\b/i.test(body);
  const risk = /\brisk level\b|\br[123]\b/i.test(body);
  const humanReview = humanReviewDecisionPresent(body);
  const residual = /\bresidual risks?\b|\bknown risks?\b|\bremaining blockers?\b/i.test(body);
  const remote = /\bremote quality[- ]gate\b|\bgithub actions\b|\bci\b/i.test(body);
  const headLine = body.match(/head\s*sha\s*[:=]\s*([a-f0-9]{40})/i);
  const expectedHead = env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '';
  const staleHead = Boolean(headLine && expectedHead && headLine[1].toLowerCase() !== String(expectedHead).toLowerCase());
  const headKnown = Boolean(headLine || expectedHead);
  const remoteClaimedPass = /\bremote quality gate\b[\s\S]{0,120}\bpass\b/i.test(body) ||
    /\bgithub actions\b[\s\S]{0,120}\bpass\b/i.test(body);
  return {
    command,
    result,
    dated,
    source,
    rollback,
    risk,
    humanReview,
    residual,
    remote,
    headKnown,
    staleHead,
    remoteClaimedPass,
    risky: isRiskyContext(body),
    productionClaim: hasProductionClaim(body),
    weakWords: hasWeakEvidenceWords(body),
    reasonedSkip: hasReasonedSkip(body),
    lower,
  };
}

export function manualOverrideLabels(body) {
  const lower = normalizeText(body);
  if (/\bcannot override\b|\bcan not override\b|\bcannot be manually overridden\b|\bmust not override\b/.test(lower)) return [];
  if (!/\bmanual confirmation\b.*\boverride\b|\boverride\b.*\bmanual confirmation\b/.test(lower)) return [];
  return nonOverridableFailures
    .filter((item) => lower.includes(item.toLowerCase()))
    .map((item) => `manual_override_attempt:${item}`);
}

function humanConfirmationDecisionLines(body) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map(stripListMarker)
    .map((line) => line.trim())
    .filter(Boolean);
  const decisionLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/^(?:human|manual)\s+confirmation\s+(?:needed|required)\b/i.test(line)) continue;
    const hasInlineDecision = /\b(?:yes|required|no|not required)\b/i.test(line);
    if (hasInlineDecision || index + 1 >= lines.length) {
      decisionLines.push(line);
      continue;
    }
    const next = lines[index + 1];
    const nextLooksLikeField = /^[A-Za-z][A-Za-z0-9 /-]{1,80}\s*:/i.test(next) ||
      /^#{1,6}\s+/.test(next);
    decisionLines.push(nextLooksLikeField ? line : `${line} ${next}`);
  }
  return decisionLines;
}

export function confirmationRequirement(body) {
  let required = false;
  let notRequired = false;
  for (const line of humanConfirmationDecisionLines(body)) {
    const lower = line.toLowerCase().replace(/\s+/g, ' ').trim();
    const lineNotRequired = /(?:needed\s*:\s*)?(?:no\b|not required\b)/i.test(lower);
    const lineRequired = /needed\s*:\s*(?:yes|required)\b/i.test(lower) ||
      /^(?:human|manual)\s+confirmation\s+required\b/i.test(lower);
    if (lineNotRequired) notRequired = true;
    if (lineRequired) required = true;
  }
  if (required && notRequired) return 'conflict';
  if (required) return 'required';
  if (notRequired) return 'not_required';
  return 'missing';
}

function booleanField(body, names) {
  for (const name of names) {
    const pattern = new RegExp(`${name}\\s*:\\s*(true|yes|pass|false|no|fail)`, 'i');
    const match = body.match(pattern);
    if (!match) continue;
    const value = match[1].toLowerCase();
    if (['true', 'yes', 'pass'].includes(value)) return true;
    if (['false', 'no', 'fail'].includes(value)) return false;
  }
  return null;
}

export function buildHumanConfirmationStatus(env = process.env) {
  const bodyInfo = readPrBody(env);
  const body = bodyInfo.body || '';
  const failures = [];
  const warnings = [];
  const labels = [];
  const missingEvidence = [];

  failures.push(...manualOverrideLabels(body));

  if (bodyInfo.prContext && !body.trim()) {
    return {
      humanConfirmationStatus: {
        status: 'fail',
        labels: ['pr_body_missing'],
        missingEvidence,
        failures: ['pr_body_missing'],
        warnings,
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'fail',
    };
  }

  const requirement = confirmationRequirement(body);
  if (requirement === 'conflict') {
    return {
      humanConfirmationStatus: {
        status: 'fail',
        labels: ['human_confirmation_conflicting_values'],
        missingEvidence,
        failures: ['human_confirmation_conflicting_values'],
        warnings,
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'fail',
    };
  }

  if (requirement !== 'required') {
    return {
      humanConfirmationStatus: {
        status: 'not_required',
        labels: [requirement === 'not_required' ? 'human_confirmation_not_required' : 'human_confirmation_not_declared'],
        missingEvidence,
        failures,
        warnings,
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'not_required',
    };
  }

  labels.push('human_confirmation_required');

  const confirmedByRole = /\bconfirmedByRole\s*:\s*\S+/i.test(body) ||
    /\bconfirmed by role\s*:\s*\S+/i.test(body);
  const reviewedItems = /\breviewedItems\s*:/i.test(body) ||
    /\breviewed items\s*:/i.test(body);
  const headMatch = body.match(/\b(?:headSha|head SHA)\s*[:=]\s*([a-f0-9]{40})/i);
  const expectedHead = env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '';
  const headPresent = Boolean(headMatch);
  const headMatches = Boolean(headMatch && expectedHead && headMatch[1].toLowerCase() === String(expectedHead).toLowerCase());
  const residualRisksAccepted = booleanField(body, ['residualRisksAccepted', 'residual risks accepted']);
  const qualityGateNotWeakened = booleanField(body, ['qualityGateNotWeakened', 'quality gate not weakened']);
  const riskLevelNotLowered = booleanField(body, ['riskLevelNotLowered', 'risk level not lowered']);

  if (!confirmedByRole) missingEvidence.push('confirmedByRole');
  if (!reviewedItems) missingEvidence.push('reviewedItems');
  if (!headPresent) missingEvidence.push('headSha');
  else if (expectedHead && !headMatches) failures.push('human_confirmation_head_sha_mismatch');
  else if (!expectedHead) missingEvidence.push('expectedHeadSha');
  if (residualRisksAccepted !== true) missingEvidence.push('residualRisksAccepted');
  if (qualityGateNotWeakened !== true) missingEvidence.push('qualityGateNotWeakened');
  if (riskLevelNotLowered !== true) missingEvidence.push('riskLevelNotLowered');

  if (qualityGateNotWeakened === false) failures.push('quality_gate_weakening_confirmed');
  if (riskLevelNotLowered === false) failures.push('risk_level_lowering_confirmed');

  const status = failures.length ? 'fail' : missingEvidence.length ? 'manual_confirmation_required' : 'pass';
  return {
    humanConfirmationStatus: {
      status,
      labels,
      missingEvidence,
      failures,
      warnings,
      evidence: {
        confirmedByRole,
        reviewedItems,
        headShaStatus: headPresent ? (headMatches ? 'matched' : 'mismatch') : 'missing',
        residualRisksAccepted: residualRisksAccepted === true,
        qualityGateNotWeakened: qualityGateNotWeakened === true,
        riskLevelNotLowered: riskLevelNotLowered === true,
      },
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status,
  };
}

function classifyProductionReadiness(env = process.env) {
  const failures = [];
  const warnings = [];
  const evidencePack = buildEvidencePackReport(env).evidencePackStatus;
  if (isStructuredEvidencePackSource(evidencePack?.source)) {
    return {
      status: evidencePack.status,
      labels: ['structured_evidence_pack_preferred'],
      failures: evidencePack.status === 'fail' ? (evidencePack.reasonCodes || ['evidence_pack_invalid']) : [],
      warnings: evidencePack.warnings || [],
      bodySource: evidencePack.source,
      evidence: {
        structuredEvidencePack: true,
        headShaStatus: (evidencePack.reasonCodes || []).includes('head_sha_mismatch') ? 'stale' : 'present',
      },
    };
  }
  const bodyInfo = readPrBody(env);
  const body = bodyInfo.body || '';
  const unsafe = unsafeLabels('productionReadinessInput', body);
  failures.push(...unsafe);
  failures.push(...manualOverrideLabels(body));

  if (bodyInfo.prContext && !body.trim()) failures.push('pr_body_missing');
  if (!bodyInfo.prContext && !body.trim()) {
    return {
      status: 'not_applicable',
      labels: ['non_pr_no_claim'],
      failures,
      warnings,
      bodySource: bodyInfo.source,
    };
  }

  const facts = evidenceFacts(body, env);
  const humanConfirmation = buildHumanConfirmationStatus(env).humanConfirmationStatus;
  if (facts.staleHead) failures.push('stale_evidence_head_sha_mismatch');
  if (facts.productionClaim) {
    const required = [
      ['execution_evidence_missing', facts.command && facts.result && facts.dated && facts.source],
      ['rollback_or_merge_after_verify_missing', facts.rollback],
      ['risk_level_missing', facts.risk],
      ['residual_risks_missing', facts.residual],
      ['human_review_decision_missing', facts.humanReview],
      ['remote_or_local_evidence_missing', facts.remote || facts.source],
      ['head_sha_missing', facts.headKnown],
    ];
    for (const [label, ok] of required) {
      if (!ok) failures.push(label);
    }
    if (facts.weakWords) failures.push('weak_evidence_used_for_production_claim');
    if (facts.remote && !facts.remoteClaimedPass && facts.risky && humanConfirmation.status !== 'pass') {
      warnings.push('remote_quality_gate_requires_manual_confirmation');
    }
  } else if (facts.risky) {
    if (!facts.humanReview) failures.push('risky_change_human_review_decision_missing');
    if (!facts.residual) failures.push('risky_change_residual_risks_missing');
    if (!facts.reasonedSkip) failures.push('skipped_check_reason_missing');
  }

  let status = 'pass';
  if (failures.length) status = 'fail';
  else if (warnings.length) status = 'manual_confirmation_required';

  return {
    status,
    labels: facts.productionClaim ? ['production_or_release_claim_detected'] : ['no_production_ready_claim'],
    failures,
    warnings,
    bodySource: bodyInfo.source,
    evidence: {
      command: facts.command,
      result: facts.result,
      dated: facts.dated,
      source: facts.source,
      rollbackOrMergeAfterVerify: facts.rollback,
      riskLevel: facts.risk,
      humanReviewDecision: facts.humanReview,
      residualRisks: facts.residual,
      remoteOrLocalEvidence: facts.remote || facts.source,
      headShaStatus: facts.staleHead ? 'stale' : facts.headKnown ? 'present' : 'missing',
    },
  };
}

export function buildProductionReadinessReport(env = process.env) {
  const status = classifyProductionReadiness(env);
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    productionReadinessStatus: {
      status: status.status,
      labels: status.labels,
      evidence: status.evidence || {},
      failures: status.failures,
      warnings: status.warnings,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    productionReadyClaim: 'NO',
    status: status.status,
    safeSummary: status.status === 'pass'
      ? 'Production readiness evidence gate passed.'
      : status.status === 'not_applicable'
        ? 'Production readiness evidence gate is not applicable for non-PR execution without production or release claims.'
        : status.status === 'manual_confirmation_required'
          ? 'Production readiness evidence gate requires manual confirmation for safe labels.'
          : 'Production readiness evidence gate failed; see safe labels only.',
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_PRODUCTION_READINESS_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  console.log(`productionReadinessStatus: ${report.productionReadinessStatus.status}`);
  console.log(report.safeSummary);
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildProductionReadinessReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      productionReadinessStatus: {
        status: 'fail',
        labels: ['unexpected_error'],
        failures: ['production_readiness_gate_unexpected_error'],
        warnings: [],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      productionReadyClaim: 'NO',
      status: 'fail',
      safeSummary: 'Production readiness evidence gate failed with an internal error.',
    };
    printReport(report);
    process.exit(1);
  }
}
