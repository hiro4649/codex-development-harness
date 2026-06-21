#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import process from 'node:process';
import { validateV128ProjectionIntegrity } from './codex-v128-integrity-lib.mjs';

const ROUTINE_READER_OUTPUT_BYTES_MAX = 1600;

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalJsonBytes(value) {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
}

export function parseJsonRejectDuplicateKeys(text) {
  const stack = [];
  let index = 0;
  function top() { return stack[stack.length - 1]; }
  function completeValue() {
    const frame = top();
    if (!frame) return;
    if (frame.type === 'object' && frame.state === 'value') frame.state = 'comma_or_end';
    else if (frame.type === 'array' && frame.state === 'value_or_end') frame.state = 'comma_or_end';
  }
  function readString() {
    let result = '';
    index += 1;
    while (index < text.length) {
      const ch = text[index];
      if (ch === '\\') {
        result += ch + (text[index + 1] || '');
        index += 2;
        continue;
      }
      if (ch === '"') {
        index += 1;
        return JSON.parse(`"${result}"`);
      }
      result += ch;
      index += 1;
    }
    throw new Error('unterminated_string');
  }
  function skipPrimitive() {
    while (index < text.length && !/[\s,\]\}]/.test(text[index])) index += 1;
    completeValue();
  }
  while (index < text.length) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    const frame = top();
    if (ch === '{') {
      stack.push({ type: 'object', keys: new Set(), state: 'key_or_end' });
      index += 1;
      continue;
    }
    if (ch === '[') {
      stack.push({ type: 'array', state: 'value_or_end' });
      index += 1;
      continue;
    }
    if (ch === '}') {
      if (!frame || frame.type !== 'object' || !['key_or_end', 'comma_or_end'].includes(frame.state)) throw new Error('object_state_invalid');
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    if (ch === ']') {
      if (!frame || frame.type !== 'array' || !['value_or_end', 'comma_or_end'].includes(frame.state)) throw new Error('array_state_invalid');
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    if (ch === ',') {
      if (!frame || frame.state !== 'comma_or_end') throw new Error('comma_state_invalid');
      frame.state = frame.type === 'object' ? 'key_or_end' : 'value_or_end';
      index += 1;
      continue;
    }
    if (ch === ':') {
      if (!frame || frame.type !== 'object' || frame.state !== 'colon') throw new Error('colon_state_invalid');
      frame.state = 'value';
      index += 1;
      continue;
    }
    if (ch === '"') {
      const value = readString();
      const current = top();
      if (current?.type === 'object' && current.state === 'key_or_end') {
        if (current.keys.has(value)) throw new Error(`duplicate_key:${value}`);
        current.keys.add(value);
        current.state = 'colon';
      } else {
        completeValue();
      }
      continue;
    }
    skipPrimitive();
  }
  if (stack.length) throw new Error('json_stack_unclosed');
  return JSON.parse(text);
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
    const integrityPass = surface.projectionIntegrityStatus === 'pass';
    const next = {
      ...surface,
      surfaceCanonicalBytes: bytes,
      withinRoutineReadBudget: withinBudget,
      status: withinBudget && surface.projectionPresent === true && integrityPass ? 'pass' : 'fail',
      reasonCodes: withinBudget && surface.projectionPresent === true && integrityPass
        ? []
        : [
            surface.projectionPresent !== true
              ? 'routine_projection_missing'
              : (integrityPass ? 'routine_projection_read_surface_over_budget' : 'routine_projection_integrity_failed'),
          ],
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
  const integrity = projectionPresent
    ? validateV128ProjectionIntegrity(projection, { verifySourceDigest: input.verifySourceDigest === true })
    : { status: 'fail', reasonCodes: ['routine_projection_missing'] };
  const surface = {
    schemaVersion: '1.2.8',
    surfaceKind: 'routine_projection_read_surface',
    managedSafeArtifactRead: 1,
    coldArtifactRead: 0,
    managedContextBytesObserved: false,
    projectionPresent,
    projectionIntegrityStatus: integrity.status,
    routineDecisionProjection: projectionPresent ? projection : null,
    safeSummaryOnly: true,
  };
  if (integrity.reasonCodes?.length) surface.projectionIntegrityReasonCodes = integrity.reasonCodes;
  return finalizeSurface(surface);
}

function buildReaderFailure(reasonCode, details = {}) {
  return {
    schemaVersion: '1.2.8',
    surfaceKind: 'routine_projection_read_surface',
    status: 'fail',
    reasonCodes: [reasonCode],
    outputBytesMax: ROUTINE_READER_OUTPUT_BYTES_MAX,
    safeSummaryOnly: true,
    ...details,
  };
}

export function formatV128ProjectionReaderOutput(surface) {
  const candidateOutput = `${canonicalJson(surface)}\n`;
  const candidateOutputBytes = Buffer.byteLength(candidateOutput, 'utf8');
  if (surface?.status === 'pass' && candidateOutputBytes <= ROUTINE_READER_OUTPUT_BYTES_MAX) {
    return {
      output: candidateOutput,
      outputBytes: candidateOutputBytes,
      exitCode: 0,
    };
  }
  const failure = buildReaderFailure(
    candidateOutputBytes > ROUTINE_READER_OUTPUT_BYTES_MAX
      ? 'routine_projection_reader_stdout_over_budget'
      : 'routine_projection_reader_surface_failed',
    {
      emittedBytesObserved: true,
      attemptedOutputBytes: candidateOutputBytes,
    },
  );
  const failureOutput = `${canonicalJson(failure)}\n`;
  return {
    output: failureOutput,
    outputBytes: Buffer.byteLength(failureOutput, 'utf8'),
    exitCode: 1,
  };
}

export function readV128RoutineProjectionSurfaceFromSafeSummaryText(text, input = {}) {
  const sourceArtifactBytes = Buffer.byteLength(text, 'utf8');
  const safeSummary = parseJsonRejectDuplicateKeys(text);
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
    const formatted = formatV128ProjectionReaderOutput(surface);
    process.stdout.write(formatted.output);
    process.exit(formatted.exitCode);
  } catch (error) {
    const failure = buildReaderFailure('routine_projection_reader_error');
    process.stdout.write(`${canonicalJson(failure)}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-projection-reader.mjs')) {
  main();
}
