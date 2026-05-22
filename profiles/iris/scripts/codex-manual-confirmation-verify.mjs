#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const policyPath = path.join('docs', 'process', 'CODEX_QUALITY_GATE_POLICY.json');
const jsonMode = process.argv.includes('--json') || process.env.CODEX_MANUAL_CONFIRMATION_REPORT === 'json';
const HARNESS_VERSION = '0.7.0';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const DEFAULT_POLICY = {
  requiredForRiskLevels: ['R3'],
  allowedSources: ['githubReview', 'prBody', 'prComment', 'localFile'],
  requireHeadSha: true,
  requireRole: true,
  requireReviewedItems: true,
  requiredReviewedItems: [],
  cannotOverride: [
    'secretScanFailure',
    'blockedPaths',
    'highConfidenceSecret',
    'implementationHarnessMixing',
    'profileRequiredFailure',
    'openaiMethodGateFailure',
  ],
};

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function safeArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [];
}
function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}
function readPolicy() {
  let policy = {};
  if (fs.existsSync(policyPath)) {
    try { policy = readJsonFile(policyPath); } catch { policy = {}; }
  }
  const configured = policy.manualConfirmationPolicy || {};
  return {
    ...DEFAULT_POLICY,
    ...configured,
    requiredForRiskLevels: safeArray(configured.requiredForRiskLevels).length ? safeArray(configured.requiredForRiskLevels) : DEFAULT_POLICY.requiredForRiskLevels,
    allowedSources: safeArray(configured.allowedSources).length ? safeArray(configured.allowedSources) : DEFAULT_POLICY.allowedSources,
    requiredReviewedItems: safeArray(configured.requiredReviewedItems),
    cannotOverride: safeArray(configured.cannotOverride).length ? safeArray(configured.cannotOverride) : DEFAULT_POLICY.cannotOverride,
  };
}
function normalizeBoolean(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'confirmed', 'pass', 'passed'].includes(text)) return true;
  if (['false', 'no', 'n', '0', 'weakened', 'lowered', 'fail', 'failed'].includes(text)) return false;
  return undefined;
}
function safeLower(value) {
  return String(value ?? '').toLowerCase();
}
function normalizeKey(value) {
  return safeLower(value).replace(/[^a-z0-9]/g, '');
}
function keyMatches(key, names) {
  const normalized = normalizeKey(key);
  return names.map(normalizeKey).includes(normalized);
}
function extractJsonCandidate(text) {
  const blocks = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fence;
  while ((fence = fencePattern.exec(text))) blocks.push(fence[1]);
  const objectPattern = /\{[\s\S]*?(?:"riskLevel"|"headSha"|"confirmedByRole")[\s\S]*?\}/gi;
  let objectMatch;
  while ((objectMatch = objectPattern.exec(text))) blocks.push(objectMatch[0]);
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Continue with the safer line parser.
    }
  }
  return null;
}
function parseListLines(lines, startIndex) {
  const items = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^[A-Za-z][A-Za-z0-9 _-]{1,60}:\s*/.test(line)) break;
    const bullet = line.match(/^[-*]\s*(.+)$/);
    if (bullet) items.push(bullet[1].trim());
  }
  return items;
}
function parseTextCandidate(text) {
  const json = extractJsonCandidate(text);
  if (json) return json;
  const lines = String(text || '').split(/\r?\n/);
  const out = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const match = line.match(/^(?:[-*]\s*)?([A-Za-z][A-Za-z0-9 _/-]{1,80})\s*:\s*(.*)$/);
    if (!match) continue;
    const [, rawKey, rawValue] = match;
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (keyMatches(key, ['profile'])) out.profile = value;
    else if (keyMatches(key, ['riskLevel', 'risk'])) out.riskLevel = value;
    else if (keyMatches(key, ['headSha', 'head', 'commit', 'headCommit'])) out.headSha = value;
    else if (keyMatches(key, ['confirmedAt'])) out.confirmedAt = value;
    else if (keyMatches(key, ['confirmedByRole', 'role', 'reviewerRole'])) out.confirmedByRole = value;
    else if (keyMatches(key, ['qualityGateNotWeakened', 'quality gate not weakened'])) out.qualityGateNotWeakened = normalizeBoolean(value);
    else if (keyMatches(key, ['riskLevelNotLowered', 'risk level not lowered'])) out.riskLevelNotLowered = normalizeBoolean(value);
    else if (keyMatches(key, ['manualBranchProtectionAcknowledged', 'manual branch protection acknowledged'])) out.manualBranchProtectionAcknowledged = normalizeBoolean(value);
    else if (keyMatches(key, ['reviewedItems', 'reviewed items'])) out.reviewedItems = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : parseListLines(lines, i);
    else if (keyMatches(key, ['residualRisks', 'residual risks'])) out.residualRisks = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : parseListLines(lines, i);
  }
  return Object.keys(out).length ? out : null;
}
function normalizeConfirmation(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    source,
    profile: String(raw.profile || '').trim(),
    riskLevel: String(raw.riskLevel || '').trim(),
    headSha: String(raw.headSha || raw.head || raw.commit || '').trim(),
    confirmedAt: String(raw.confirmedAt || '').trim(),
    confirmedByRole: String(raw.confirmedByRole || raw.role || '').trim(),
    reviewedItems: safeArray(raw.reviewedItems),
    qualityGateNotWeakened: normalizeBoolean(raw.qualityGateNotWeakened),
    riskLevelNotLowered: normalizeBoolean(raw.riskLevelNotLowered),
    residualRisks: Array.isArray(raw.residualRisks) ? raw.residualRisks.map((item) => String(item || '').trim()).filter(Boolean) : [],
    manualBranchProtectionAcknowledged: normalizeBoolean(raw.manualBranchProtectionAcknowledged),
  };
}
function statusBase({ required, policy, riskLevel, headSha, profile, cannotOverrideFailures }) {
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    required,
    status: required ? 'manual_confirmation_required' : 'not_required',
    source: 'none',
    profile,
    riskLevel,
    headSha,
    headShaMatched: false,
    stale: false,
    missingItems: [],
    cannotOverrideFailures,
    allowedSources: policy.allowedSources,
    githubApiAvailable: false,
    recommendedAction: required ? 'record manual confirmation for the current head' : 'manual confirmation not required',
  };
}
function validateConfirmation(candidate, context) {
  const { policy, headSha, riskLevel, profile, cannotOverrideFailures } = context;
  const missing = [];
  if (policy.requireHeadSha && !candidate.headSha) missing.push('headSha');
  if (policy.requireRole && !candidate.confirmedByRole) missing.push('confirmedByRole');
  if (policy.requireReviewedItems && !candidate.reviewedItems.length) missing.push('reviewedItems');
  if (!candidate.riskLevel) missing.push('riskLevel');
  if (candidate.riskLevel && candidate.riskLevel !== riskLevel) missing.push('riskLevelCurrent');
  if (candidate.profile && profile && candidate.profile !== profile) missing.push('profileCurrent');
  if (candidate.qualityGateNotWeakened !== true) missing.push('qualityGateNotWeakened');
  if (candidate.riskLevelNotLowered !== true) missing.push('riskLevelNotLowered');
  if (!candidate.residualRisks.length) missing.push('residualRisks');
  if (candidate.manualBranchProtectionAcknowledged !== true) missing.push('manualBranchProtectionAcknowledged');
  const reviewedLower = candidate.reviewedItems.map(safeLower);
  for (const item of policy.requiredReviewedItems || []) {
    if (!reviewedLower.some((reviewed) => reviewed.includes(safeLower(item)))) missing.push(`reviewedItem:${item}`);
  }
  const headShaMatched = Boolean(headSha && candidate.headSha && candidate.headSha === headSha);
  const stale = Boolean(policy.requireHeadSha && headSha && candidate.headSha && candidate.headSha !== headSha);
  const status = !missing.length && (!policy.requireHeadSha || headShaMatched) && !cannotOverrideFailures.length ? 'pass' : 'manual_confirmation_required';
  return {
    required: true,
    status,
    source: candidate.source,
    profile,
    riskLevel,
    headSha,
    headShaMatched,
    stale,
    missingItems: [...new Set(missing)].sort(),
    cannotOverrideFailures,
    confirmedByRole: candidate.confirmedByRole ? 'role-recorded' : '',
    reviewedItemCount: candidate.reviewedItems.length,
    residualRiskCount: candidate.residualRisks.length,
    githubApiAvailable: context.githubApiAvailable === true,
    recommendedAction: status === 'pass'
      ? 'manual confirmation accepted for current head'
      : (cannotOverrideFailures.length ? 'fix non-overridable failures before merge' : 'record complete manual confirmation for the current head'),
  };
}
async function githubJson(url, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'codex-quality-harness-manual-confirmation',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API request failed: ${response.status}`);
  return response.json();
}
async function githubCandidates(policy, context) {
  const candidates = [];
  const repo = process.env.CODEX_REPOSITORY || process.env.GITHUB_REPOSITORY || '';
  const pr = process.env.CODEX_PR_NUMBER || '';
  const token = process.env.CODEX_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  const apiEnabled = process.env.CODEX_GITHUB_API_AVAILABLE !== '0' && repo && pr && token && typeof fetch === 'function';
  context.githubApiAvailable = Boolean(apiEnabled);
  if (!apiEnabled) return candidates;
  const api = `https://api.github.com/repos/${repo}`;
  const prData = await githubJson(`${api}/pulls/${pr}`, token);
  if (!context.headSha && prData?.head?.sha) context.headSha = prData.head.sha;
  if (policy.allowedSources.includes('prBody')) {
    const parsed = parseTextCandidate(prData?.body || '');
    const normalized = normalizeConfirmation(parsed, 'prBody');
    if (normalized) candidates.push(normalized);
  }
  if (policy.allowedSources.includes('prComment')) {
    const comments = await githubJson(`${api}/issues/${pr}/comments?per_page=100`, token);
    for (const comment of comments || []) {
      const parsed = parseTextCandidate(comment?.body || '');
      const normalized = normalizeConfirmation(parsed, 'prComment');
      if (normalized) candidates.push(normalized);
    }
  }
  if (policy.allowedSources.includes('githubReview')) {
    const reviews = await githubJson(`${api}/pulls/${pr}/reviews?per_page=100`, token);
    for (const review of reviews || []) {
      if (String(review?.state || '').toUpperCase() !== 'APPROVED') continue;
      if (context.headSha && review?.commit_id && review.commit_id !== context.headSha) {
        candidates.push(normalizeConfirmation({
          riskLevel: context.riskLevel,
          headSha: review.commit_id,
          confirmedByRole: 'github-reviewer',
          reviewedItems: policy.requiredReviewedItems.length ? policy.requiredReviewedItems : ['quality evidence'],
          qualityGateNotWeakened: true,
          riskLevelNotLowered: true,
          residualRisks: ['approved review was not for the current head'],
          manualBranchProtectionAcknowledged: true,
        }, 'githubReview'));
        continue;
      }
      candidates.push(normalizeConfirmation({
        riskLevel: context.riskLevel,
        headSha: review?.commit_id || context.headSha,
        confirmedByRole: 'github-reviewer',
        reviewedItems: policy.requiredReviewedItems.length ? policy.requiredReviewedItems : ['quality evidence'],
        qualityGateNotWeakened: true,
        riskLevelNotLowered: true,
        residualRisks: ['review approval recorded in GitHub'],
        manualBranchProtectionAcknowledged: true,
      }, 'githubReview'));
    }
  }
  return candidates;
}
async function main() {
  const policy = readPolicy();
  const riskLevel = process.env.CODEX_MANUAL_CONFIRMATION_RISK_LEVEL || process.env.CODEX_RISK_LEVEL || 'R1';
  const profile = process.env.CODEX_MANUAL_CONFIRMATION_PROFILE || process.env.CODEX_PROFILE || 'generic';
  let headSha = process.env.CODEX_MANUAL_CONFIRMATION_HEAD_SHA || process.env.CODEX_PR_HEAD_SHA || '';
  const requiredItems = safeArray(parseJsonEnv('CODEX_MANUAL_CONFIRMATION_REQUIRED_ITEMS', policy.requiredReviewedItems));
  if (requiredItems.length) policy.requiredReviewedItems = requiredItems;
  const cannotOverrideFailures = safeArray(parseJsonEnv('CODEX_MANUAL_CONFIRMATION_CANNOT_OVERRIDE_FAILURES', []));
  const envRequired = process.env.CODEX_MANUAL_CONFIRMATION_REQUIRED === '1';
  const required = envRequired || policy.requiredForRiskLevels.includes(riskLevel);
  if (!required) return statusBase({ required, policy, riskLevel, headSha, profile, cannotOverrideFailures });
  const context = { policy, riskLevel, profile, headSha, cannotOverrideFailures, githubApiAvailable: false };
  const candidates = [];
  const envJson = parseJsonEnv('CODEX_MANUAL_CONFIRMATION_JSON', null);
  const envCandidate = normalizeConfirmation(envJson, 'workflowEnv');
  if (envCandidate) candidates.push(envCandidate);
  const localFile = process.env.CODEX_MANUAL_CONFIRMATION_FILE || '';
  if (localFile && policy.allowedSources.includes('localFile') && fs.existsSync(localFile)) {
    try {
      const parsed = readJsonFile(localFile);
      const normalized = normalizeConfirmation(parsed, 'localFile');
      if (normalized) candidates.push(normalized);
    } catch {
      // Leave a safe missing status below.
    }
  }
  try {
    candidates.push(...await githubCandidates(policy, context));
  } catch {
    context.githubApiAvailable = false;
  }
  headSha = context.headSha || headSha;
  const evaluated = candidates.map((candidate) => validateConfirmation(candidate, { ...context, headSha }));
  const pass = evaluated.find((item) => item.status === 'pass');
  if (pass) return { ...pass, allowedSources: policy.allowedSources, githubApiAvailable: context.githubApiAvailable };
  const best = evaluated[0] || statusBase({ required, policy, riskLevel, headSha, profile, cannotOverrideFailures });
  return {
    ...best,
    status: 'manual_confirmation_required',
    allowedSources: policy.allowedSources,
    githubApiAvailable: context.githubApiAvailable,
    recommendedAction: cannotOverrideFailures.length ? 'fix non-overridable failures before merge' : (context.githubApiAvailable ? 'record complete manual confirmation for current head' : 'manual confirmation required; GitHub API was unavailable or no source matched'),
  };
}

main().then((result) => {
  if (jsonMode) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    console.log('Codex manual confirmation verifier safe summary:');
    console.log(`required: ${result.required === true}`);
    console.log(`status: ${result.status}`);
    console.log(`source: ${result.source || 'none'}`);
    console.log(`headShaMatched: ${result.headShaMatched === true}`);
    console.log(`stale: ${result.stale === true}`);
    console.log(`missingItems: ${(result.missingItems || []).length}`);
    console.log(`cannotOverrideFailures: ${(result.cannotOverrideFailures || []).length}`);
    console.log(`recommendedAction: ${result.recommendedAction}`);
  }
  process.exit(result.required && result.status !== 'pass' ? 1 : 0);
}).catch(() => {
  const result = {
    marker,
    harnessVersion: HARNESS_VERSION,
    required: true,
    status: 'manual_confirmation_required',
    source: 'none',
    headShaMatched: false,
    stale: false,
    missingItems: ['verifierError'],
    cannotOverrideFailures: [],
    recommendedAction: 'manual confirmation required; verifier could not complete safely',
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else console.log('Codex manual confirmation verifier safe summary: status=manual_confirmation_required');
  process.exit(1);
});
