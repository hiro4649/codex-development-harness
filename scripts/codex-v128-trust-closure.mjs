#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const V128_TRUST_CLOSURE_FILES = [
  'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json',
  'docs/process/CODEX_V128_SPEC.md',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'docs/process/CODEX_V128_STATE_MATRIX.json',
  'docs/process/CODEX_V128_PRESERVATION_MATRIX.json',
  'scripts/codex-v128-standing-autonomy-policy.mjs',
  'scripts/codex-v128-trust-closure.mjs',
  'scripts/codex-v128-self-test.mjs',
  'scripts/codex-v128-validation-execution-plan.mjs',
  'scripts/codex-v128-integrity-lib.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-projection-reader-adapter.mjs',
  'scripts/codex-v128-managed-context-emitter.mjs',
  'scripts/codex-v128-managed-context-adapter.mjs',
  'scripts/codex-v128-state-matrix.mjs',
  'scripts/codex-v128-state-matrix-adapter.mjs',
  'scripts/codex-v128-aggregate-finalizer.mjs',
  'scripts/codex-v128-aggregate-finalizer-adapter.mjs',
  'scripts/codex-v128-invocation-ledger.mjs',
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-workflow-quality-runner.mjs',
  'scripts/codex-final-decision-kernel.mjs',
  'scripts/codex-evidence-capsule.mjs',
  'scripts/codex-artifact-consistency-contract.mjs',
];

const PROVIDER_ADAPTER_FILES = [
  'scripts/codex-workflow-quality-runner.mjs',
  'scripts/codex-evidence-capsule.mjs',
  'scripts/codex-artifact-consistency-contract.mjs',
  'scripts/codex-local-quality-gate.mjs',
];

const SCOPE_CLASSIFIER_FILES = [
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-v128-standing-autonomy-policy.mjs',
  'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json',
];

const MERGE_EXECUTOR_FILES = [
  'scripts/codex-v128-standing-autonomy-policy.mjs',
  'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json',
];

const CANONICALIZER_FILES = [
  'scripts/codex-v128-integrity-lib.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-managed-context-emitter.mjs',
];

const FINAL_DECISION_AUTHORITY_FILES = [
  'scripts/codex-final-decision-kernel.mjs',
  'scripts/codex-decision-capsule.mjs',
  'scripts/codex-evidence-capsule.mjs',
  'scripts/codex-reason-summary.mjs',
  'scripts/codex-artifact-consistency-contract.mjs',
];

const ROLE_TRUST_CLOSURE_SEEDS = {
  verifier_bundle: V128_TRUST_CLOSURE_FILES,
  provider_adapter: PROVIDER_ADAPTER_FILES,
  scope_classifier: SCOPE_CLASSIFIER_FILES,
  merge_executor: MERGE_EXECUTOR_FILES,
  canonicalizer: CANONICALIZER_FILES,
  final_decision_authority: FINAL_DECISION_AUTHORITY_FILES,
};

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function digestText(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function readFileDigest(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const text = fs.readFileSync(normalized, 'utf8');
  return {
    path: normalized,
    digest: digestText(text),
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

function compareUtf8Path(a, b) {
  return Buffer.compare(Buffer.from(String(a), 'utf8'), Buffer.from(String(b), 'utf8'));
}

function sourceFileExists(filePath) {
  return fs.existsSync(String(filePath).replace(/\\/g, '/'));
}

function resolveRelativePath(fromPath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  const candidates = [
    base,
    `${base}.mjs`,
    `${base}.js`,
    `${base}.json`,
    path.posix.join(base, 'index.mjs'),
    path.posix.join(base, 'index.js'),
  ];
  return candidates.find((candidate) => sourceFileExists(candidate)) || null;
}

function discoverRelativeDependencies(file = {}) {
  const dependencies = [];
  const text = file.text || '';
  const importPattern = /(?:import\s+(?:[^'"]*?\s+from\s*)?|export\s+[^'"]*?\s+from\s*|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;
  const fsLiteralPattern = /\b(?:readFileSync|readJson|loadPolicy)\(\s*['"]([^'"]+)['"]/g;
  const addDependency = (specifier) => {
    const resolved = resolveRelativePath(file.path, specifier);
    if (resolved) dependencies.push({ from: file.path, specifier, resolved });
  };
  let match;
  while ((match = importPattern.exec(text)) !== null) {
    const specifier = String(match[1] || '');
    if (specifier.startsWith('.')) addDependency(specifier);
  }
  while ((match = fsLiteralPattern.exec(text)) !== null) {
    const specifier = String(match[1] || '');
    if (specifier.startsWith('.')) addDependency(specifier);
    else if ((specifier.startsWith('docs/') || specifier.startsWith('scripts/')) && sourceFileExists(specifier)) {
      dependencies.push({ from: file.path, specifier, resolved: specifier.replace(/\\/g, '/') });
    }
  }
  dependencies.sort((a, b) => compareUtf8Path(a.resolved, b.resolved));
  return dependencies;
}

function buildTransitiveFileDigests(seedFiles = [], input = {}) {
  const maxFiles = Number(input.maxClosureFiles || 512);
  const queue = seedFiles.map((file) => String(file).replace(/\\/g, '/')).sort(compareUtf8Path);
  const byPath = new Map();
  const missingFiles = [];
  const unresolvedImports = [];
  const edges = [];
  let truncated = false;
  while (queue.length) {
    const current = queue.shift();
    if (byPath.has(current)) continue;
    if (byPath.size >= maxFiles) {
      truncated = true;
      break;
    }
    try {
      const text = fs.readFileSync(current, 'utf8');
      const file = {
        path: current,
        digest: digestText(text),
        bytes: Buffer.byteLength(text, 'utf8'),
        text,
      };
      byPath.set(current, file);
      for (const edge of discoverRelativeDependencies(file)) {
        edges.push(edge);
        if (!byPath.has(edge.resolved) && !queue.includes(edge.resolved)) {
          queue.push(edge.resolved);
          queue.sort(compareUtf8Path);
        }
      }
    } catch {
      missingFiles.push(current);
    }
  }
  const fileDigests = [...byPath.values()]
    .map(({ text, ...entry }) => entry)
    .sort((a, b) => compareUtf8Path(a.path, b.path));
  return {
    fileDigests,
    missingFiles: missingFiles.sort(compareUtf8Path),
    edges,
    relativeImportEdgeCount: edges.length,
    transitiveRelativeImportCount: fileDigests.length - new Set(seedFiles).size,
    sourceClosureTruncated: truncated,
    closureCompletenessState: missingFiles.length || truncated ? 'incomplete' : 'complete',
  };
}

function roleClosureSummary(role, seedFiles, input = {}) {
  const closure = buildTransitiveFileDigests(seedFiles, input);
  return {
    role,
    seedFileCount: seedFiles.length,
    fileCount: closure.fileDigests.length,
    relativeImportEdgeCount: closure.relativeImportEdgeCount,
    transitiveRelativeImportCount: closure.transitiveRelativeImportCount,
    sourceClosureTruncated: closure.sourceClosureTruncated,
    closureCompletenessState: closure.closureCompletenessState,
    missingFileCount: closure.missingFiles.length,
    missingFiles: closure.missingFiles,
    fileDigests: closure.fileDigests,
    roleClosureDigest: digestValue({
      role,
      fileDigests: closure.fileDigests,
      missingFiles: closure.missingFiles,
    }),
  };
}

function buildRoleClosures(input = {}) {
  return Object.fromEntries(Object.entries(ROLE_TRUST_CLOSURE_SEEDS).map(([role, seedFiles]) => [
    role,
    roleClosureSummary(role, seedFiles, input),
  ]));
}

export function buildV128TrustClosure(input = {}) {
  const files = Array.isArray(input.files) && input.files.length
    ? input.files
    : V128_TRUST_CLOSURE_FILES;
  const {
    fileDigests,
    missingFiles,
    relativeImportEdgeCount,
    transitiveRelativeImportCount,
    sourceClosureTruncated,
    closureCompletenessState,
  } = buildTransitiveFileDigests(files, input);
  const roleClosures = buildRoleClosures(input);
  const trustDigests = {
    verifierBundleDigest: roleClosures.verifier_bundle.roleClosureDigest,
    providerAdapterDigest: roleClosures.provider_adapter.roleClosureDigest,
    scopeClassifierDigest: roleClosures.scope_classifier.roleClosureDigest,
    mergeExecutorDigest: roleClosures.merge_executor.roleClosureDigest,
    canonicalizerDigest: roleClosures.canonicalizer.roleClosureDigest,
    finalDecisionAuthorityDigest: roleClosures.final_decision_authority.roleClosureDigest,
  };
  const closure = {
    schemaVersion: '1.2.8',
    closureKind: 'v128_trust_closure_shadow',
    closureFileCount: fileDigests.length,
    seedFileCount: files.length,
    relativeImportEdgeCount,
    transitiveRelativeImportCount,
    sourceClosureTruncated,
    closureCompletenessState,
    missingFileCount: missingFiles.length,
    missingFiles,
    trustDigests,
    roleClosures: Object.fromEntries(Object.entries(roleClosures).map(([role, closure]) => [
      role,
      {
        role: closure.role,
        seedFileCount: closure.seedFileCount,
        fileCount: closure.fileCount,
        relativeImportEdgeCount: closure.relativeImportEdgeCount,
        transitiveRelativeImportCount: closure.transitiveRelativeImportCount,
        sourceClosureTruncated: closure.sourceClosureTruncated,
        closureCompletenessState: closure.closureCompletenessState,
        missingFileCount: closure.missingFileCount,
        missingFiles: closure.missingFiles,
        roleClosureDigest: closure.roleClosureDigest,
      },
    ])),
    fileDigests,
    prHeadMayAuthorizeItself: false,
    safeSummaryOnly: true,
  };
  return {
    ...closure,
    trustClosureDigest: digestValue({
      closureKind: closure.closureKind,
      fileDigests,
      trustDigests,
      roleClosures: closure.roleClosures,
      missingFiles,
    }),
  };
}

export function validateV128TrustClosure(closure = {}) {
  const reasons = [];
  if (closure.schemaVersion !== '1.2.8') reasons.push('trust_closure_schema_invalid');
  if (closure.closureKind !== 'v128_trust_closure_shadow') reasons.push('trust_closure_kind_invalid');
  if (closure.prHeadMayAuthorizeItself !== false) reasons.push('trust_closure_self_authorization_forbidden');
  if (Number(closure.missingFileCount || 0) !== 0) reasons.push('trust_closure_missing_files');
  if (closure.closureCompletenessState !== 'complete') reasons.push('trust_closure_incomplete');
  if (closure.sourceClosureTruncated === true) reasons.push('trust_closure_truncated');
  for (const key of ['verifierBundleDigest', 'providerAdapterDigest', 'scopeClassifierDigest', 'mergeExecutorDigest', 'canonicalizerDigest', 'finalDecisionAuthorityDigest']) {
    if (!/^sha256:[a-f0-9]{64}$/.test(String(closure.trustDigests?.[key] || ''))) {
      reasons.push(`trust_closure_${key}_invalid`);
    }
  }
  for (const [role, roleClosure] of Object.entries(closure.roleClosures || {})) {
    if (roleClosure.closureCompletenessState !== 'complete') reasons.push(`trust_closure_${role}_incomplete`);
    if (roleClosure.sourceClosureTruncated === true) reasons.push(`trust_closure_${role}_truncated`);
    if (Number(roleClosure.missingFileCount || 0) !== 0) reasons.push(`trust_closure_${role}_missing_files`);
    if (!/^sha256:[a-f0-9]{64}$/.test(String(roleClosure.roleClosureDigest || ''))) reasons.push(`trust_closure_${role}_digest_invalid`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(String(closure.trustClosureDigest || ''))) reasons.push('trust_closure_digest_invalid');
  return reasons.length ? { status: 'fail', reasonCodes: reasons, safeSummaryOnly: true } : {
    status: 'pass',
    trustClosureDigest: closure.trustClosureDigest,
    verifierBundleDigest: closure.trustDigests.verifierBundleDigest,
    providerAdapterDigest: closure.trustDigests.providerAdapterDigest,
    scopeClassifierDigest: closure.trustDigests.scopeClassifierDigest,
    mergeExecutorDigest: closure.trustDigests.mergeExecutorDigest,
    canonicalizerDigest: closure.trustDigests.canonicalizerDigest,
    finalDecisionAuthorityDigest: closure.trustDigests.finalDecisionAuthorityDigest,
    closureFileCount: closure.closureFileCount,
    roleClosureCount: Object.keys(closure.roleClosures || {}).length,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-trust-closure.mjs')) {
  const closure = buildV128TrustClosure();
  const validation = validateV128TrustClosure(closure);
  process.stdout.write(`${canonicalJson({ closure, validation })}\n`);
  process.exit(validation.status === 'pass' ? 0 : 1);
}
