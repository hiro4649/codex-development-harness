#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const MANAGED_CONTEXT_BYTES_MAX = 2300;
const COMPILED_CONTEXT_BYTES_MAX = 1400;
const RESIDENT_CONTEXT_BYTES_MAX = 2048;
const DELTA_CONTEXT_BYTES_MAX = 768;
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

function canonicalBytes(value) {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
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

function optionalFileDigest(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fileDigest(filePath);
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

function buildV128ResidentContext(parts = {}, compiled = {}) {
  const standingPolicy = optionalFileDigest('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const sourceManifest = parts.sourceManifest || {};
  const activePolicyIndex = parts.activePolicyIndex || {};
  const scopeContract = {
    activeHarnessVersion: sourceManifest.activeHarnessVersion || '1.2.7',
    activeSelfTestSuite: sourceManifest.activeSelfTestSuite || 'v127',
    candidateHarnessVersion: '1.2.8',
    candidateActivationState: 'source_shadow_candidate',
    sourceActivation: sourceManifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.sourceActivation || 'not_started',
    targetRollout: sourceManifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.targetRollout || 'not_started',
    noProductScope: true,
    noPackageOrLockfile: true,
    noWorkflowWeakening: true,
  };
  const residentCore = {
    schemaVersion: '1.2.8',
    contextKind: 'resident_context_shadow',
    activeInstructionDigest: compiled.compiledContextDigest,
    activeProfileDigest: digestValue(activePolicyIndex.deterministicDecisionProjectionAndTokenMinimalLoopClosure || {}),
    scopeContractDigest: digestValue(scopeContract),
    standingPolicyDigest: standingPolicy ? `sha256:${standingPolicy.sha256}` : null,
    verifierProfileDigest: digestValue({
      bindingIds: compiled.bindingIds || [],
      requiredBindingIds: REQUIRED_BINDING_IDS,
      finalAuthority: 'v1.1.8_final_decision_kernel',
    }),
    fullInstructionTextStored: false,
    llmSummaryUsed: false,
  };
  const residentContextDigest = digestValue(residentCore);
  const residentContext = {
    ...residentCore,
    residentContextDigest,
    residentContextBytes: 0,
    residentContextBytesMax: RESIDENT_CONTEXT_BYTES_MAX,
    withinResidentContextBudget: false,
  };
  for (let i = 0; i < 4; i += 1) {
    const bytes = canonicalBytes(residentContext);
    const next = {
      ...residentContext,
      residentContextBytes: bytes,
      withinResidentContextBudget: bytes <= RESIDENT_CONTEXT_BYTES_MAX,
    };
    if (next.residentContextBytes === residentContext.residentContextBytes
      && next.withinResidentContextBudget === residentContext.withinResidentContextBudget) {
      return next;
    }
    Object.assign(residentContext, next);
  }
  return residentContext;
}

function buildV128DeltaPacket(input = {}) {
  const deltaCore = {
    schemaVersion: '1.2.8',
    packetKind: 'delta_packet_shadow',
    failedReasonRefs: Array.isArray(input.failedReasonRefs) ? input.failedReasonRefs.map(String).slice(0, 6) : [],
    failedNodeRefs: Array.isArray(input.failedNodeRefs) ? input.failedNodeRefs.map(String).slice(0, 6) : [],
    newEvidenceRefs: Array.isArray(input.newEvidenceRefs) ? input.newEvidenceRefs.map(String).slice(0, 6) : [],
    lastAttemptDigest: input.lastAttemptDigest || null,
    nextActionCode: input.nextActionCode || 'AUTO_WAIT',
    fullContextResendCount: Number(input.fullContextResendCount ?? 1),
  };
  const deltaPacketDigest = digestValue(deltaCore);
  const deltaPacket = {
    ...deltaCore,
    deltaPacketDigest,
    deltaContextBytes: 0,
    deltaContextBytesMax: DELTA_CONTEXT_BYTES_MAX,
    withinDeltaContextBudget: false,
  };
  for (let i = 0; i < 4; i += 1) {
    const bytes = canonicalBytes(deltaPacket);
    const next = {
      ...deltaPacket,
      deltaContextBytes: bytes,
      withinDeltaContextBudget: bytes <= DELTA_CONTEXT_BYTES_MAX,
    };
    if (next.deltaContextBytes === deltaPacket.deltaContextBytes
      && next.withinDeltaContextBudget === deltaPacket.withinDeltaContextBudget) {
      return next;
    }
    Object.assign(deltaPacket, next);
  }
  return deltaPacket;
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
    const residentWithinBudget = Number(context.residentContextBytes || 0) <= RESIDENT_CONTEXT_BYTES_MAX;
    const deltaWithinBudget = Number(context.deltaContextBytes || 0) <= DELTA_CONTEXT_BYTES_MAX;
    const fullContextResendWithinBudget = Number(context.fullContextResendCount ?? 0) <= 1;
    const bindingsComplete = Array.isArray(context.missingBindingIds) && context.missingBindingIds.length === 0;
    const pass = withinBudget
      && compiledWithinBudget
      && residentWithinBudget
      && deltaWithinBudget
      && fullContextResendWithinBudget
      && bindingsComplete;
    const next = {
      ...context,
      managedContextBytes: bytes,
      withinManagedContextBudget: withinBudget,
      status: pass ? 'pass' : 'fail',
      reasonCodes: [
        ...(withinBudget ? [] : ['managed_context_over_budget']),
        ...(compiledWithinBudget ? [] : ['compiled_active_instruction_over_budget']),
        ...(residentWithinBudget ? [] : ['resident_context_over_budget']),
        ...(deltaWithinBudget ? [] : ['delta_context_over_budget']),
        ...(fullContextResendWithinBudget ? [] : ['full_context_resend_over_budget']),
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
  const residentContext = buildV128ResidentContext(parts, compiled);
  const deltaPacket = buildV128DeltaPacket(input);
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
    compiledContextStored: false,
    compiledActiveInstructionBytes: compiled.compiledActiveInstructionBytes,
    compiledActiveInstructionBytesMax: compiled.compiledActiveInstructionBytesMax,
    compiledContextBytes: compiled.compiledActiveInstructionBytes,
    compiledContextBytesMax: compiled.compiledActiveInstructionBytesMax,
    compiledContextDigest: compiled.compiledContextDigest,
    compiledContextSource: compiled.compiledContextSource,
    residentContextDigest: residentContext.residentContextDigest,
    residentContextBytes: residentContext.residentContextBytes,
    residentContextBytesMax: residentContext.residentContextBytesMax,
    deltaPacketDigest: deltaPacket.deltaPacketDigest,
    deltaContextBytes: deltaPacket.deltaContextBytes,
    deltaContextBytesMax: deltaPacket.deltaContextBytesMax,
    fullContextResendCount: deltaPacket.fullContextResendCount,
    residentContextKind: residentContext.contextKind,
    deltaPacketKind: deltaPacket.packetKind,
    bindingIdsDigest: digestValue(compiled.bindingIds),
    bindingIdCount: compiled.bindingIds.length,
    missingBindingIds: compiled.missingBindingIds,
    sourceFileSetDigest: digestValue(sourceFileDigests),
    sourceFileCount: sourceFiles.length,
    instructionCapsuleDigest: digestValue(instructionCapsule),
    providerSummaryDigest: digestValue(providerSummary),
    attestedViewDigest: digestValue(attestedView),
    routineManagedSafeArtifactRead: 1,
    routineColdArtifactRead: 0,
    legacyRead: 0,
    foreignProfileRead: 0,
    reviewerFanout: 0,
    routineSelectedSkill: 0,
    repeatedSafetyText: 0,
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
