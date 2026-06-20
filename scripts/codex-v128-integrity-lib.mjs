#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';

export const V128_PROJECTION_SOURCE_FILES = [
  'docs/process/CODEX_V128_SPEC.md',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'docs/process/CODEX_V128_STATE_MATRIX.json',
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-v128-integrity-lib.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-state-matrix.mjs',
];

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function digestValue(value) {
  return `sha256:${sha256(canonicalJson(value === undefined ? null : value))}`;
}

function projectionPayloadForDigest(projection = {}) {
  const {
    sourceBinding,
    projectionCanonicalBytes,
    withinRoutineBudget,
    ...payload
  } = projection || {};
  return payload;
}

export function buildV128ProjectionInputDigest(input = {}) {
  const inputDigests = {
    decisionCapsuleDigest: digestValue(input.decisionCapsule ?? null),
    evidenceCapsuleDigest: digestValue(input.evidenceCapsule ?? null),
    finalDecisionDigest: digestValue(input.finalDecision ?? null),
  };
  return `sha256:${sha256(canonicalJson(inputDigests))}`;
}

export function buildV128ProjectionPayloadDigest(projection = {}) {
  return digestValue(projectionPayloadForDigest(projection));
}

export function buildV128ProjectionSourceDigestBinding(headSha = 'unknown', input = {}) {
  const sources = V128_PROJECTION_SOURCE_FILES.map((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return {
      path: file,
      sha256: sha256(text),
      bytes: Buffer.byteLength(text, 'utf8'),
    };
  });
  return {
    kind: 'v128_projection_binding',
    headSha,
    generatorContractDigest: `sha256:${sha256(canonicalJson(sources))}`,
    projectionInputDigest: buildV128ProjectionInputDigest(input),
    projectionPayloadDigest: buildV128ProjectionPayloadDigest(input.projectionPayload ?? null),
    sourceCount: sources.length,
  };
}

export function validateV128ProjectionIntegrity(projection = {}, input = {}) {
  const reasons = [];
  const binding = projection.sourceBinding || {};
  if (projection.schemaVersion !== '1.2.8') reasons.push('projection_schema_invalid');
  if (!String(projection.projectionKind || '').startsWith('routine_decision_projection')) reasons.push('projection_kind_invalid');
  if (projection.authority !== 'non_authoritative_projection') reasons.push('projection_authority_invalid');
  if (!projection.headSha || projection.headSha === 'unknown') reasons.push('projection_head_missing');
  if (binding.kind !== 'v128_projection_binding') reasons.push('projection_source_binding_kind_invalid');
  if (binding.headSha !== projection.headSha) reasons.push('projection_source_binding_head_mismatch');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(binding.generatorContractDigest || ''))) reasons.push('projection_generator_contract_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(binding.projectionInputDigest || ''))) reasons.push('projection_input_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(binding.projectionPayloadDigest || ''))) reasons.push('projection_payload_digest_invalid');
  if (Number(binding.sourceCount || 0) < V128_PROJECTION_SOURCE_FILES.length) reasons.push('projection_source_binding_count_invalid');
  const expectedPayloadDigest = buildV128ProjectionPayloadDigest(projection);
  if (binding.projectionPayloadDigest !== expectedPayloadDigest) reasons.push('projection_payload_digest_mismatch');
  let inputBindingState = 'attested_not_recomputed';
  if (input.verifyInputDigest === true) {
    inputBindingState = 'verified';
    const expectedInputDigest = buildV128ProjectionInputDigest(input);
    if (binding.projectionInputDigest !== expectedInputDigest) {
      inputBindingState = 'mismatch';
      reasons.push('projection_input_digest_mismatch');
    }
  }
  let generatorContractState = 'attested_not_recomputed';
  if (input.verifySourceDigest === true) {
    generatorContractState = 'verified';
    const expected = buildV128ProjectionSourceDigestBinding(projection.headSha);
    if (binding.generatorContractDigest !== expected.generatorContractDigest) {
      generatorContractState = 'mismatch';
      reasons.push('projection_source_binding_digest_mismatch');
    }
  }
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    checkedSchema: projection.schemaVersion || null,
    checkedHead: projection.headSha || null,
    sourceBindingDigest: binding.generatorContractDigest || null,
    payloadIntegrityState: binding.projectionPayloadDigest === expectedPayloadDigest ? 'verified' : 'mismatch',
    inputBindingState,
    generatorContractState,
    safeSummaryOnly: true,
  };
}
