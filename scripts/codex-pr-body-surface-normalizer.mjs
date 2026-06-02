#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { fileURLToPath } from 'node:url';
import { isPrContext, normalizePath, prBodyText, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const surfacePatterns = {
  auth: /\b(?:auth(?:entication|orization)?|security|permission|role|session|token|login|oauth)\b/i,
  storage: /\b(?:storage|database|postgres|sqlite|migration|schema|concurrency|json-store|repository)\b/i,
  api: /\b(?:api|route|controller|handler|request\/response|request response|compatibility)\b/i,
  runtime: /\b(?:runtime|worker|adapter|queue|server|client|readiness)\b/i,
  release: /\b(?:release_gate|release|deploy|deployment|production|go\/no-go|go no-go)\b/i,
};

function splitChangedFiles(value) {
  if (Array.isArray(value)) return value.map(normalizePath).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(normalizePath).filter(Boolean);
  } catch {
    // Fall through to a line/comma separated parse.
  }
  return text.split(/[\n,]+/).map((item) => normalizePath(item.trim())).filter(Boolean);
}

function surfaceFromFile(file) {
  const normalized = normalizePath(file);
  const surfaces = [];
  if (/^(src|apps|contracts)\//.test(normalized)) {
    if (/\b(auth|security|login|session|token|permission|role)\b/i.test(normalized)) surfaces.push('auth');
    if (/\b(storage|database|db|migration|concurrency|repository|json)\b/i.test(normalized)) surfaces.push('storage');
    if (/\b(api|route|controller|handler|contract)\b/i.test(normalized)) surfaces.push('api');
    if (/\b(runtime|worker|queue|server|client|adapter)\b/i.test(normalized)) surfaces.push('runtime');
  }
  if (/^(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(normalized)) surfaces.push('release');
  return surfaces;
}

function headingKind(line) {
  const normalized = line.trim().replace(/^#+\s*/, '').toLowerCase();
  if (!normalized) return null;
  if (/forbidden scope|constraints|out of scope|not included|no product|prohibited/.test(normalized)) return 'forbidden';
  if (/residual risk|remaining risk|known risk/.test(normalized)) return 'residual';
  return 'body';
}

function isNegatedSurfaceLine(line, surface) {
  const text = line.toLowerCase();
  const label = surface === 'auth' ? '(?:auth|authentication|authorization|security)' : surface;
  const negation = new RegExp(`\\b(no|not|without|none|excluded|forbidden)\\b[^\\n]{0,48}\\b${label}\\b|\\b${label}\\b[^\\n]{0,48}\\b(no|not|without|none|excluded|forbidden|not included|not applicable)\\b`, 'i');
  return negation.test(text) || /no product surface changed|product code changed\s*:\s*no|runtime readiness claimed\s*:\s*no/i.test(line);
}

function detectBodySurfaces(body) {
  const detected = new Set();
  const negated = new Set();
  const forbidden = new Set();
  const residual = new Set();
  let section = 'body';
  for (const rawLine of String(body || '').split(/\r?\n/)) {
    const kind = headingKind(rawLine);
    if (/^\s*#/.test(rawLine) && kind) section = kind;
    const line = rawLine.trim();
    if (!line) continue;
    for (const [surface, pattern] of Object.entries(surfacePatterns)) {
      if (!pattern.test(line)) continue;
      if (section === 'forbidden') forbidden.add(surface);
      else if (section === 'residual') residual.add(surface);
      else if (isNegatedSurfaceLine(line, surface)) negated.add(surface);
      else detected.add(surface);
    }
  }
  if (/runtime readiness claimed\s*:\s*yes/i.test(body)) detected.add('runtime');
  return { detected, negated, forbidden, residual };
}

function requiredHeadingHint(body, env = process.env) {
  if (!isPrContext(env) && !String(body || '').trim()) {
    return {
      status: 'pass',
      missingHeadings: [],
      nearMisses: [],
      safeSuggestedPatch: [],
      safeSummaryOnly: true,
    };
  }
  const required = ['## Task Contract', '## Evidence Integrity', '## Testing and review'];
  const missingHeadings = [];
  const nearMisses = [];
  for (const heading of required) {
    const name = heading.replace(/^#+\s*/, '');
    const exact = new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(body);
    if (exact) continue;
    missingHeadings.push(heading);
    if (new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*$`, 'im').test(body)) {
      nearMisses.push({ expected: heading, found: name });
    }
  }
  return {
    status: missingHeadings.length ? 'warning' : 'pass',
    missingHeadings,
    nearMisses,
    safeSuggestedPatch: missingHeadings.slice(0, 5).map((heading) => `Add heading: ${heading}`),
    safeSummaryOnly: true,
  };
}

export function normalizePrBodySurfaces(files = [], body = '', env = process.env) {
  const fileSurfaces = new Set();
  for (const file of files) {
    for (const surface of surfaceFromFile(file)) fileSurfaces.add(surface);
  }
  const bodySurfaces = detectBodySurfaces(body);
  const effective = new Set(fileSurfaces);
  for (const surface of bodySurfaces.detected) {
    if (!bodySurfaces.negated.has(surface) && !bodySurfaces.forbidden.has(surface) && !bodySurfaces.residual.has(surface)) {
      effective.add(surface);
    }
  }
  return {
    detectedSurfaces: [...new Set([...bodySurfaces.detected, ...fileSurfaces])].sort(),
    negatedSurfaces: [...bodySurfaces.negated].sort(),
    forbiddenScopeSurfaces: [...bodySurfaces.forbidden].sort(),
    residualRiskSurfaces: [...bodySurfaces.residual].sort(),
    effectiveChangedSurfaces: [...effective].sort(),
    requiredHeadingHintStatus: requiredHeadingHint(body, env),
  };
}

export function effectiveSurfacesForComplexity(files = [], body = '') {
  const normalized = normalizePrBodySurfaces(files, body);
  return {
    auth: normalized.effectiveChangedSurfaces.includes('auth'),
    storage: normalized.effectiveChangedSurfaces.includes('storage'),
    api: normalized.effectiveChangedSurfaces.includes('api'),
    runtime: normalized.effectiveChangedSurfaces.includes('runtime'),
    release: normalized.effectiveChangedSurfaces.includes('release'),
  };
}

export function buildPrBodySurfaceNormalizerReport(env = process.env) {
  const files = splitChangedFiles(env.CODEX_CHANGED_FILES);
  const body = prBodyText(env);
  const normalized = normalizePrBodySurfaces(files, body, env);
  const status = scanObjectForUnsafe(normalized).length ? 'fail' : 'pass';
  const reasonCodes = status === 'fail' ? ['pr_body_surface_normalizer_failed'] : [];
  return simpleStatus('prBodySurfaceNormalizerStatus', status, {
    ...normalized,
    reasonCodes,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildPrBodySurfaceNormalizerReport();
    writeJsonReport(report, 'CODEX_PR_BODY_SURFACE_NORMALIZER_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('prBodySurfaceNormalizerStatus', 'fail', { reasonCodes: ['pr_body_surface_normalizer_failed'] });
    writeJsonReport(report, 'CODEX_PR_BODY_SURFACE_NORMALIZER_REPORT');
    process.exit(1);
  }
}
