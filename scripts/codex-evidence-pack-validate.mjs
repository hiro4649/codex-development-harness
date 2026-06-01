#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSafeOutput } from './codex-safe-output-scan.mjs';

export const HARNESS_VERSION = '1.0.1';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const defaultPackPath = path.join('.codex', 'evidence-pack.json');
const requiredTopLevel = [
  'schemaVersion',
  'harnessVersion',
  'repository',
  'prNumber',
  'headSha',
  'baseSha',
  'changeType',
  'riskLevel',
  'scope',
  'commands',
  'remoteRuns',
  'residualRisks',
  'productionClaims',
  'rollbackOrStopCondition',
  'humanConfirmation',
  'safeOutput',
];

export function isStructuredEvidencePackSource(source) {
  return typeof source === 'string' && source.startsWith('evidence_pack');
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function readJson(file) {
  const text = readText(file);
  if (text === null) return { ok: false, reasonCode: 'evidence_pack_missing' };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reasonCode: 'evidence_pack_invalid' };
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseJsonBlocks(text, beginMarker, endMarker, property) {
  const source = String(text || '');
  const pattern = new RegExp(`${escapeRegExp(beginMarker)}\\s*([\\s\\S]*?)\\s*${escapeRegExp(endMarker)}`, 'gi');
  const blocks = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.[property] && typeof parsed[property] === 'object') blocks.push(parsed[property]);
    } catch {
      blocks.push({ __invalid: true });
    }
  }
  return blocks;
}

function pushStructuredCandidate(candidates, pack, source) {
  if (!pack) return;
  const sourceCount = candidates.filter((candidate) => candidate.source === source || candidate.source.startsWith(`${source}_`)).length;
  candidates.push({
    pack,
    source: sourceCount ? `${source}_${sourceCount}` : source,
  });
}

export function collectStructuredEvidencePackCandidates(env = process.env) {
  const candidates = [];
  const sources = [
    [env.CODEX_PR_COMMENTS || '', 'evidence_pack_pr_comment'],
    [env.CODEX_PR_REVIEWS || '', 'evidence_pack_pr_review'],
    [prBodyText(env), 'evidence_pack_pr_body'],
  ];
  for (const [text, source] of sources) {
    for (const pack of parseJsonBlocks(
      text,
      'BEGIN_CODEX_EVIDENCE_PACK_JSON',
      'END_CODEX_EVIDENCE_PACK_JSON',
      'codexEvidencePack',
    )) {
      pushStructuredCandidate(candidates, pack, source);
    }
  }
  return candidates;
}

export function selectValidEvidencePackCandidate(candidates, env = process.env) {
  const evaluated = candidates.map((candidate) => ({
    ...candidate,
    validation: candidate.pack?.__invalid
      ? {
        status: 'fail',
        reasonCodes: ['evidence_pack_invalid'],
        warnings: [],
        missingFields: [],
        normalized: null,
      }
      : validateEvidencePack(candidate.pack, env),
  }));
  return evaluated.find((candidate) => candidate.validation.status === 'pass') || evaluated[0] || null;
}

function evidencePackPath(env = process.env) {
  if (env.CODEX_EVIDENCE_PACK_PATH) return env.CODEX_EVIDENCE_PACK_PATH;
  return fs.existsSync(defaultPackPath) ? defaultPackPath : '';
}

function isPrContext(env = process.env) {
  return env.CODEX_EVENT_NAME === 'pull_request' ||
    Boolean(env.CODEX_PR_NUMBER) ||
    Boolean(env.GITHUB_REF && env.GITHUB_REF.includes('/pull/'));
}

function isSourceHarnessMode(env = process.env) {
  return env.CODEX_HARNESS_SOURCE_REPO === '1';
}

function isStrictEvidencePackMode(env = process.env) {
  return env.CODEX_EVIDENCE_PACK_STRICT === '1' ||
    (isSourceHarnessMode(env) && isPrContext(env));
}

function hasPrBodyFallback(env = process.env) {
  if (env.CODEX_PR_BODY && env.CODEX_PR_BODY.trim()) return true;
  if (env.CODEX_PR_BODY_PATH && readText(env.CODEX_PR_BODY_PATH)?.trim()) return true;
  if (env.GITHUB_EVENT_PATH) {
    const text = readText(env.GITHUB_EVENT_PATH);
    if (!text) return false;
    try {
      return Boolean(JSON.parse(text).pull_request?.body);
    } catch {
      return false;
    }
  }
  return false;
}

function prBodyText(env = process.env) {
  if (env.CODEX_PR_BODY) return env.CODEX_PR_BODY;
  if (env.CODEX_PR_BODY_PATH) return readText(env.CODEX_PR_BODY_PATH) || '';
  if (env.GITHUB_EVENT_PATH) {
    const text = readText(env.GITHUB_EVENT_PATH);
    if (!text) return '';
    try {
      return JSON.parse(text).pull_request?.body || '';
    } catch {
      return '';
    }
  }
  return '';
}

export function evidencePackFromStructuredText(env = process.env) {
  const selected = selectValidEvidencePackCandidate(collectStructuredEvidencePackCandidates(env), env);
  if (!selected) return null;
  return { pack: selected.pack, source: selected.source, validation: selected.validation };
}

function normalizedStatus(value, allowed) {
  return allowed.includes(value) ? value : 'invalid';
}

export function validateEvidencePack(pack, env = process.env) {
  const reasonCodes = [];
  const warnings = [];
  const missingFields = [];

  for (const field of requiredTopLevel) {
    if (!(field in pack)) missingFields.push(field);
  }
  if (missingFields.length) reasonCodes.push('evidence_pack_invalid');

  if (pack.harnessVersion && !['0.8.1', '0.8.2', '0.8.3', '0.8.4', HARNESS_VERSION].some((version) => String(pack.harnessVersion).startsWith(version))) {
    warnings.push('evidence_pack_harness_version_compatibility_warning');
  }
  const expectedHead = env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '';
  if (!pack.headSha) reasonCodes.push('missing_head_sha');
  else if (expectedHead && String(pack.headSha).toLowerCase() !== String(expectedHead).toLowerCase()) {
    reasonCodes.push('head_sha_mismatch');
  }

  if (!pack.scope || typeof pack.scope !== 'object') reasonCodes.push('scope_mismatch');
  else {
    for (const field of ['changedFiles', 'allowedPaths', 'forbiddenPaths']) {
      if (!Array.isArray(pack.scope[field])) reasonCodes.push('scope_mismatch');
    }
  }

  if (!Array.isArray(pack.commands) || !pack.commands.length) reasonCodes.push('missing_command_result');
  else {
    for (const command of pack.commands) {
      if (!command || typeof command !== 'object' || !command.name || !command.result) {
        reasonCodes.push('missing_command_result');
      }
    }
  }

  if (!Array.isArray(pack.remoteRuns)) reasonCodes.push('missing_remote_evidence');
  if (!Array.isArray(pack.residualRisks) || !pack.residualRisks.length) reasonCodes.push('stale_evidence');
  if (!pack.rollbackOrStopCondition) reasonCodes.push('missing_remote_evidence');

  if (pack.safeOutput) {
    const status = normalizedStatus(pack.safeOutput.status || pack.safeOutput, ['pass', 'fail', 'pending']);
    if (status !== 'pass') reasonCodes.push('unsafe_value_detected');
  }

  const unsafe = scanSafeOutput(pack);
  reasonCodes.push(...unsafe.findings.map((item) => item.reasonCode));

  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes: [...new Set(reasonCodes)],
    warnings: [...new Set(warnings)],
    missingFields,
    source: 'evidence_pack_file',
    normalized: {
      schemaVersionPresent: Boolean(pack.schemaVersion),
      repositoryPresent: Boolean(pack.repository),
      prNumberPresent: Boolean(pack.prNumber),
      headShaStatus: reasonCodes.includes('head_sha_mismatch') ? 'mismatch' : pack.headSha ? 'present' : 'missing',
      commandCount: Array.isArray(pack.commands) ? pack.commands.length : 0,
      remoteRunCount: Array.isArray(pack.remoteRuns) ? pack.remoteRuns.length : 0,
      residualRiskCount: Array.isArray(pack.residualRisks) ? pack.residualRisks.length : 0,
    },
  };
}

export function buildEvidencePackReport(env = process.env) {
  const file = evidencePackPath(env);
  const strict = isStrictEvidencePackMode(env);
  if (!file) {
    const structured = evidencePackFromStructuredText(env);
    if (structured) {
      if (structured.pack.__invalid) {
        return {
          marker,
          harnessVersion: HARNESS_VERSION,
          evidencePackStatus: {
            status: 'fail',
            source: structured.source,
            reasonCodes: ['evidence_pack_invalid'],
            safeSummaryOnly: true,
          },
          normalizedEvidencePack: null,
          valuesPrinted: false,
          status: 'fail',
        };
      }
      const validation = structured.validation || validateEvidencePack(structured.pack, env);
      return {
        marker,
        harnessVersion: HARNESS_VERSION,
        evidencePackStatus: {
          status: validation.status,
          source: structured.source,
          reasonCodes: validation.reasonCodes,
          warnings: validation.warnings,
          missingFields: validation.missingFields,
          safeSummaryOnly: true,
        },
        normalizedEvidencePack: validation.normalized,
        valuesPrinted: false,
        status: validation.status,
      };
    }
    if (strict) {
      return {
        marker,
        harnessVersion: HARNESS_VERSION,
        evidencePackStatus: {
          status: 'manual_confirmation_required',
          source: hasPrBodyFallback(env) ? 'pr_body_legacy_fallback' : 'missing',
          reasonCodes: ['evidence_pack_missing'],
          warnings: hasPrBodyFallback(env) ? ['evidence_pack_missing_legacy_fallback'] : [],
          safeSummaryOnly: true,
        },
        normalizedEvidencePack: null,
        valuesPrinted: false,
        status: 'manual_confirmation_required',
      };
    }
    if (isPrContext(env) || hasPrBodyFallback(env)) {
      return {
        marker,
        harnessVersion: HARNESS_VERSION,
        evidencePackStatus: {
          status: 'pass',
          source: 'pr_body_legacy_fallback',
          reasonCodes: [],
          warnings: ['evidence_pack_missing_legacy_fallback'],
          safeSummaryOnly: true,
        },
        normalizedEvidencePack: null,
        valuesPrinted: false,
        status: 'pass',
      };
    }
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      evidencePackStatus: {
        status: 'not_applicable',
        source: 'none',
        reasonCodes: [],
        safeSummaryOnly: true,
      },
      normalizedEvidencePack: null,
      valuesPrinted: false,
      status: 'not_applicable',
    };
  }

  const parsed = readJson(file);
  if (!parsed.ok) {
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      evidencePackStatus: {
        status: 'fail',
        source: 'evidence_pack',
        reasonCodes: [parsed.reasonCode],
        safeSummaryOnly: true,
      },
      normalizedEvidencePack: null,
      valuesPrinted: false,
      status: 'fail',
    };
  }

  const validation = validateEvidencePack(parsed.value, env);
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    evidencePackStatus: {
      status: validation.status,
      source: 'evidence_pack_file',
      reasonCodes: validation.reasonCodes,
      warnings: validation.warnings,
      missingFields: validation.missingFields,
      safeSummaryOnly: true,
    },
    normalizedEvidencePack: validation.normalized,
    valuesPrinted: false,
    status: validation.status,
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_EVIDENCE_PACK_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`evidencePackStatus: ${report.evidencePackStatus.status}`);
    console.log(report.status === 'pass' ? 'Evidence pack validation passed.' : 'Evidence pack validation did not pass.');
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildEvidencePackReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      evidencePackStatus: {
        status: 'fail',
        reasonCodes: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      normalizedEvidencePack: null,
      valuesPrinted: false,
      status: 'fail',
    };
    printReport(report);
    process.exit(1);
  }
}
