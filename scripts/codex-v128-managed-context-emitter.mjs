#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const MANAGED_CONTEXT_BYTES_MAX = 4096;
const SOURCE_FILES = [
  'AGENTS.md',
  'CODEX_SOURCE_HARNESS_MANIFEST.json',
  'docs/process/CODEX_HARNESS_MANIFEST.json',
  'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
  'docs/process/CODEX_V128_SPEC.md',
];

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function fileDigest(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return {
    path: filePath,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function firstLine(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0] || fallback;
  } catch {
    return fallback;
  }
}

function finalizeContext(contextBase) {
  let context = {
    ...contextBase,
    managedContextBytes: 0,
    withinManagedContextBudget: false,
    status: 'fail',
    reasonCodes: ['managed_context_unmeasured'],
  };
  for (let i = 0; i < 8; i += 1) {
    const bytes = Buffer.byteLength(canonicalJson(context), 'utf8');
    const withinBudget = bytes <= MANAGED_CONTEXT_BYTES_MAX;
    const next = {
      ...context,
      managedContextBytes: bytes,
      withinManagedContextBudget: withinBudget,
      status: withinBudget ? 'pass' : 'fail',
      reasonCodes: withinBudget ? [] : ['managed_context_over_budget'],
    };
    if (next.managedContextBytes === context.managedContextBytes
      && next.withinManagedContextBudget === context.withinManagedContextBudget
      && next.status === context.status) {
      return next;
    }
    context = next;
  }
  return context;
}

export function buildV128ManagedContextEmitter(input = {}) {
  const sourceManifest = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const targetManifest = readJson('docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicyIndex = readJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const headSha = input.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
  return finalizeContext({
    schemaVersion: '1.2.8',
    contextKind: 'managed_context_emitter_shadow',
    authority: 'non_authoritative_context_surface',
    activeHarnessVersion: sourceManifest.activeHarnessVersion || '1.2.7',
    activeSelfTestSuite: sourceManifest.activeSelfTestSuite || 'v127',
    candidateHarnessVersion: '1.2.8',
    candidateActivationState: 'source_shadow_candidate',
    sourceActivationReady: false,
    managedContextMeasurementSource: 'v128_managed_context_emitter',
    managedContextBytesMax: MANAGED_CONTEXT_BYTES_MAX,
    sourceFiles: SOURCE_FILES.map((file) => fileDigest(file)),
    instructionCapsule: {
      rootAgentsMarker: firstLine('AGENTS.md'),
      activeSpecPath: 'docs/process/CODEX_V127_SPEC.md',
      candidateSpecPath: 'docs/process/CODEX_V128_SPEC.md',
      profile: activePolicyIndex.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.activationState || 'source_shadow_candidate',
      llmSummaryUsed: false,
      forbiddenBoundaryWeakeningAllowed: false,
    },
    providerSummary: {
      provider: process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local',
      headSha,
      requiredCheckSet: process.env.GITHUB_ACTIONS === 'true' ? 'quality-gate' : 'local_quality_gate',
      runId: process.env.GITHUB_RUN_ID || '',
    },
    attestedView: {
      finalAuthority: 'v1.1.8_final_decision_kernel',
      activeAuthority: `${sourceManifest.activeHarnessVersion || '1.2.7'} / ${sourceManifest.activeSelfTestSuite || 'v127'}`,
      sourceHarnessVersion: sourceManifest.sourceHarnessVersion || '1.2.8',
      targetHarnessVersion: targetManifest.targetHarnessVersion || '1.2.7',
      projectionAuthority: 'non_authoritative',
      prBodyMachineEvidence: false,
      sourceActivation: sourceManifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.sourceActivation || 'not_started',
      targetRollout: sourceManifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.targetRollout || 'not_started',
    },
    safeSummaryOnly: true,
  });
}

function main() {
  try {
    const context = buildV128ManagedContextEmitter();
    process.stdout.write(`${canonicalJson(context)}\n`);
    process.exit(context.status === 'pass' ? 0 : 1);
  } catch {
    process.stdout.write(`${canonicalJson({
      schemaVersion: '1.2.8',
      contextKind: 'managed_context_emitter_shadow',
      status: 'fail',
      reasonCodes: ['managed_context_emitter_error'],
      safeSummaryOnly: true,
    })}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-managed-context-emitter.mjs')) {
  main();
}
