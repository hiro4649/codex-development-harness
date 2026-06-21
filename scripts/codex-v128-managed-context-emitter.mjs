#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const MANAGED_CONTEXT_BYTES_MAX = 4096;
const COMPILED_CONTEXT_BYTES_MAX = 1400;
const REQUIRED_BINDING_IDS = [
  'FD_AUTH',
  'DC_AUTH',
  'SAME_HEAD',
  'SOURCE_TARGET_MODE',
  'PROCESS_RECEIPT',
  'PR_BODY_DISPLAY',
  'RAWLOG_BLOCK',
  'NO_SELF_APPROVAL',
  'NO_GH_APPROVAL_REVIEW',
  'RUNTIME_DEPLOY_WALLET_BOUNDARY',
  'STOP_CIRCUIT',
  'PROJECTION_NONAUTH',
];
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

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
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

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function firstLine(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0] || fallback;
  } catch {
    return fallback;
  }
}

function extractActiveBlock(filePath) {
  const text = readText(filePath);
  const match = text.match(/<!-- CODEX_ACTIVE_BLOCK_BEGIN -->([\s\S]*?)<!-- CODEX_ACTIVE_BLOCK_END -->/);
  if (!match) throw new Error(`missing active block: ${filePath}`);
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function collectBindingIds(text) {
  return [...text.matchAll(/machineBindingId=([A-Z0-9_]+)/g)].map((match) => match[1]);
}

function buildManagedContextInputParts(input = {}) {
  const sourceManifest = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const targetManifest = readJson('docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicyIndex = readJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const headSha = input.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
  const sourceFileDigests = SOURCE_FILES.map((file) => fileDigest(file));
  const sourceFiles = SOURCE_FILES.slice();
  const instructionCapsule = {
    rootAgentsMarker: firstLine('AGENTS.md'),
    rootActiveBlockDigest: `sha256:${sha256(extractActiveBlock('AGENTS.md'))}`,
    activeSpecPath: 'docs/process/CODEX_V127_SPEC.md',
    candidateSpecPath: 'docs/process/CODEX_V128_SPEC.md',
    profile: activePolicyIndex.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.activationState || 'source_shadow_candidate',
    llmSummaryUsed: false,
    forbiddenBoundaryWeakeningAllowed: false,
  };
  const providerSummary = {
    provider: process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local',
    headSha,
    requiredCheckSet: process.env.GITHUB_ACTIONS === 'true' ? 'quality-gate' : 'local_quality_gate',
    runId: process.env.GITHUB_RUN_ID || '',
  };
  const attestedView = {
    finalAuthority: 'v1.1.8_final_decision_kernel',
    activeAuthority: `${sourceManifest.activeHarnessVersion || '1.2.7'} / ${sourceManifest.activeSelfTestSuite || 'v127'}`,
    sourceHarnessVersion: sourceManifest.sourceHarnessVersion || '1.2.8',
    targetHarnessVersion: targetManifest.targetHarnessVersion || '1.2.7',
    projectionAuthority: 'non_authoritative',
    prBodyMachineEvidence: false,
    sourceActivation: sourceManifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.sourceActivation || 'not_started',
    targetRollout: sourceManifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.targetRollout || 'not_started',
  };
  return { sourceManifest, targetManifest, activePolicyIndex, headSha, sourceFiles, sourceFileDigests, instructionCapsule, providerSummary, attestedView };
}

function buildCompiledActiveInstructionCapsule(parts = {}) {
  const sourceManifest = parts.sourceManifest || {};
  const targetManifest = parts.targetManifest || {};
  const providerSummary = parts.providerSummary || {};
  const attestedView = parts.attestedView || {};
  const rootActiveBlock = extractActiveBlock('AGENTS.md');
  const bindingIds = collectBindingIds(rootActiveBlock);
  const missingBindingIds = REQUIRED_BINDING_IDS.filter((id) => !bindingIds.includes(id));
  const headerLines = [
    'CODEX_ACTIVE_CONTEXT v1.2.8 shadow',
    `active=${sourceManifest.activeHarnessVersion || '1.2.7'}/${sourceManifest.activeSelfTestSuite || 'v127'}`,
    'candidate=1.2.8/source_shadow_candidate',
    `head=${providerSummary.headSha || 'unknown'}`,
    `target=${targetManifest.targetHarnessVersion || '1.2.7'} sourceActivation=${attestedView.sourceActivation || 'not_started'} targetRollout=${attestedView.targetRollout || 'not_started'}`,
  ];
  const text = `${headerLines.join('\n')}\n${rootActiveBlock}\n`;
  return {
    compiledContext: text,
    compiledActiveInstructionBytes: Buffer.byteLength(text, 'utf8'),
    compiledActiveInstructionBytesMax: COMPILED_CONTEXT_BYTES_MAX,
    compiledContextDigest: `sha256:${sha256(text)}`,
    compiledContextSource: 'exact_marker_delimited_active_block',
    bindingIds,
    missingBindingIds,
    llmSummaryUsed: false,
  };
}

export function buildV128ManagedInstructionSourceSetDigest(input = {}) {
  const {
    sourceFiles,
    sourceFileDigests,
    instructionCapsule,
    providerSummary,
    attestedView,
  } = buildManagedContextInputParts(input);
  return digestValue({ sourceFiles, sourceFileDigests, instructionCapsule, providerSummary, attestedView });
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
    const compiledWithinBudget = Number(context.compiledActiveInstructionBytes || context.compiledContextBytes || 0) <= COMPILED_CONTEXT_BYTES_MAX;
    const bindingsComplete = Array.isArray(context.missingBindingIds) && context.missingBindingIds.length === 0;
    const pass = withinBudget && compiledWithinBudget && bindingsComplete;
    const next = {
      ...context,
      managedContextBytes: bytes,
      withinManagedContextBudget: withinBudget,
      status: pass ? 'pass' : 'fail',
      reasonCodes: [
        ...(withinBudget ? [] : ['managed_context_over_budget']),
        ...(compiledWithinBudget ? [] : ['compiled_active_instruction_over_budget']),
        ...(bindingsComplete ? [] : ['compiled_active_instruction_missing_binding']),
      ],
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
  const parts = buildManagedContextInputParts(input);
  const {
    sourceManifest,
    targetManifest,
    sourceFiles,
    sourceFileDigests,
    instructionCapsule,
    providerSummary,
    attestedView,
  } = parts;
  const compiled = buildCompiledActiveInstructionCapsule(parts);
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
    activeInstructionSourceSetDigest: buildV128ManagedInstructionSourceSetDigest(input),
    compiledContext: compiled.compiledContext,
    compiledActiveInstructionBytes: compiled.compiledActiveInstructionBytes,
    compiledActiveInstructionBytesMax: compiled.compiledActiveInstructionBytesMax,
    compiledContextBytes: compiled.compiledActiveInstructionBytes,
    compiledContextBytesMax: compiled.compiledActiveInstructionBytesMax,
    compiledContextDigest: compiled.compiledContextDigest,
    compiledContextSource: compiled.compiledContextSource,
    bindingIds: compiled.bindingIds,
    missingBindingIds: compiled.missingBindingIds,
    sourceFileSetDigest: digestValue(sourceFileDigests),
    routineManagedSafeArtifactRead: 1,
    routineColdArtifactRead: 0,
    legacyRead: 0,
    foreignProfileRead: 0,
    reviewerFanout: 0,
    routineSelectedSkill: 0,
    repeatedSafetyText: 0,
    sourceFiles,
    instructionCapsule,
    providerSummary,
    attestedView,
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
