#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  readPrBody,
  hasProductionClaim,
  unsafeLabels,
  evidenceFacts,
  buildHumanConfirmationStatus,
} from './codex-production-readiness-gate.mjs';
import { buildEvidencePackReport, isStructuredEvidencePackSource } from './codex-evidence-pack-validate.mjs';
import { buildPrProfileReport } from './codex-pr-profile-gate.mjs';

export const HARNESS_VERSION = '1.0.1';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const requiredSections = [
  'Goal',
  'Context',
  'Files or scope',
  'Constraints',
  'Done when',
  'Plan-first status',
  'Testing and review',
  'Residual risks',
  'Human confirmation needed',
  'Production Go/No-Go',
  'Evidence Integrity',
  'Hermes Invariants',
  'Remote/Local Evidence',
  'Rollback or Merge-After Verify',
  'Stale Evidence Check',
  'Manual Confirmation Limits',
];

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--json') args.json = true;
    else if (item === '--body') args.body = argv[++i];
    else if (item === '--head') args.head = argv[++i];
  }
  return args;
}

function bodyFromArgs(args, env) {
  if (args.body) {
    const body = readText(args.body);
    return { body: body || '', prContext: true, source: 'body_file_arg' };
  }
  return readPrBody(env);
}

function sectionPresent(body, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\n)\\s*(?:#{1,6}\\s*)?${escaped}\\s*:`, 'im').test(body) ||
    new RegExp(`(^|\\n)\\s*(?:#{1,6}\\s*)?${escaped}\\s*$`, 'im').test(body);
}

function riskLevelPresent(body) {
  return /\brisk level\s*:\s*(?:R[123]|low|medium|high)\b/i.test(body) ||
    /(^|\n)\s*#{1,6}\s*Risk level\s*(?:\r?\n)+\s*(?:R[123]|low|medium|high)\b/i.test(body);
}

export function buildPrBodyLintReport(env = process.env, argv = process.argv) {
  const args = parseArgs(argv);
  const scopedEnv = { ...env };
  if (args.head) scopedEnv.CODEX_PR_HEAD_SHA = args.head;
  const bodyInfo = bodyFromArgs(args, scopedEnv);
  const body = bodyInfo.body || '';
  scopedEnv.CODEX_PR_BODY = body;
  const failures = [];
  const warnings = [];
  const missingSections = [];

  if (!bodyInfo.prContext && !body.trim()) {
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      prBodyLintStatus: {
        status: 'not_applicable',
        source: bodyInfo.source,
        reasonCodes: [],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'not_applicable',
    };
  }
  if (bodyInfo.prContext && !body.trim()) failures.push('pr_body_missing');

  for (const section of requiredSections) {
    if (!sectionPresent(body, section)) missingSections.push(section);
  }
  if (missingSections.length) failures.push('missing_required_method_sections');

  const facts = evidenceFacts(body, scopedEnv);
  const human = buildHumanConfirmationStatus(scopedEnv).humanConfirmationStatus;
  const evidencePack = buildEvidencePackReport(scopedEnv).evidencePackStatus;
  const profile = buildPrProfileReport(scopedEnv).prProfileStatus;
  const unsafe = unsafeLabels('prBody', body);
  failures.push(...unsafe);

  if (!riskLevelPresent(body)) failures.push('risk_level_missing');
  if (hasProductionClaim(body) && (!facts.command || !facts.result || !facts.headKnown)) {
    failures.push('unsafe_claim_wording');
  }
  if (!isStructuredEvidencePackSource(evidencePack.source)) {
    if (!facts.command || !facts.result) failures.push('missing_command_result');
    if (!facts.residual) failures.push('stale_evidence');
  }
  if (human.status === 'manual_confirmation_required') warnings.push('missing_human_confirmation');
  if (human.status === 'fail') failures.push('manual_confirmation_invalid');
  if (!/\bnon[- ]overridable failures?\b/i.test(body) && !/\bmanual confirmation limits\b/i.test(body)) {
    failures.push('manual_confirmation_limits_missing');
  }

  const status = failures.length ? 'fail' : warnings.length ? 'manual_confirmation_required' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    prBodyLintStatus: {
      status,
      source: bodyInfo.source,
      reasonCodes: [...new Set([...failures, ...warnings])],
      missingSections,
      evidencePackSource: evidencePack.source || 'none',
      prProfile: profile.profile || null,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status,
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_PR_BODY_LINT_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`prBodyLintStatus: ${report.prBodyLintStatus.status}`);
    console.log(report.status === 'pass' ? 'PR body lint passed.' : 'PR body lint did not pass.');
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildPrBodyLintReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      prBodyLintStatus: {
        status: 'fail',
        reasonCodes: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'fail',
    };
    printReport(report);
    process.exit(1);
  }
}
