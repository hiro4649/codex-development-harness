#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import process from 'node:process';

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalJsonBytes(value) {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
}

function finalizeSurface(surfaceBase) {
  let surface = {
    ...surfaceBase,
    surfaceCanonicalBytes: 0,
    withinRoutineReadBudget: false,
    status: 'fail',
    reasonCodes: ['routine_projection_read_surface_unmeasured'],
  };
  for (let i = 0; i < 8; i += 1) {
    const bytes = canonicalJsonBytes(surface);
    const withinBudget = bytes <= 1600;
    const next = {
      ...surface,
      surfaceCanonicalBytes: bytes,
      withinRoutineReadBudget: withinBudget,
      status: withinBudget && surface.projectionPresent === true ? 'pass' : 'fail',
      reasonCodes: withinBudget && surface.projectionPresent === true
        ? []
        : [surface.projectionPresent === true ? 'routine_projection_read_surface_over_budget' : 'routine_projection_missing'],
    };
    if (next.surfaceCanonicalBytes === surface.surfaceCanonicalBytes
      && next.withinRoutineReadBudget === surface.withinRoutineReadBudget
      && next.status === surface.status
      && next.reasonCodes.join('|') === surface.reasonCodes.join('|')) {
      return next;
    }
    surface = next;
  }
  return surface;
}

export function buildV128RoutineProjectionReadSurface(projection, input = {}) {
  const projectionPresent = projection !== null && typeof projection === 'object' && !Array.isArray(projection);
  const sourceArtifactBytesObserved = input.sourceArtifactBytesObserved === true;
  const sourceArtifactBytes = sourceArtifactBytesObserved ? Math.max(0, Number(input.sourceArtifactBytes || 0)) : null;
  return finalizeSurface({
    schemaVersion: '1.2.8',
    surfaceKind: 'routine_projection_read_surface',
    sourceArtifact: input.sourceArtifact || 'codex-quality-gate-safe-summary.json',
    extractedField: 'routineDecisionProjection',
    authority: 'non_authoritative_projection',
    activeHarnessVersion: '1.2.7',
    candidateHarnessVersion: '1.2.8',
    candidateActivationState: 'source_shadow_candidate',
    managedSafeArtifactRead: 1,
    coldArtifactRead: 0,
    routineReadSurfaceBytesMax: 1600,
    sourceArtifactBytesObserved,
    sourceArtifactBytes,
    managedContextBytesObserved: false,
    managedContextMeasurementSource: 'not_observed',
    projectionPresent,
    routineDecisionProjection: projectionPresent ? projection : null,
    safeSummaryOnly: true,
  });
}

export function readV128RoutineProjectionSurfaceFromSafeSummaryText(text, input = {}) {
  const sourceArtifactBytes = Buffer.byteLength(text, 'utf8');
  const safeSummary = JSON.parse(text);
  return buildV128RoutineProjectionReadSurface(safeSummary.routineDecisionProjection, {
    ...input,
    sourceArtifactBytesObserved: true,
    sourceArtifactBytes,
  });
}

export function readV128RoutineProjectionSurfaceFromFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return readV128RoutineProjectionSurfaceFromSafeSummaryText(text, { sourceArtifact: 'codex-quality-gate-safe-summary.json' });
}

function main() {
  const filePath = process.argv[2] || process.env.CODEX_V128_SAFE_SUMMARY_PATH || 'codex-quality-gate-safe-summary.json';
  try {
    const surface = readV128RoutineProjectionSurfaceFromFile(filePath);
    process.stdout.write(`${JSON.stringify(surface, null, 2)}\n`);
    process.exit(surface.status === 'pass' ? 0 : 1);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: '1.2.8',
      surfaceKind: 'routine_projection_read_surface',
      status: 'fail',
      reasonCodes: ['routine_projection_reader_error'],
      safeSummaryOnly: true,
    }, null, 2)}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-projection-reader.mjs')) {
  main();
}
