#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadV132Policy, readJsonStrict } from './codex-v132-manifest-compiler.mjs';
import { canonicalJson, sha256 } from './codex-v132-evidence-truth.mjs';
import { runV132CompatibilityBehaviorInvariants } from './codex-v132-compatibility-invariants.mjs';

export const V132_CANONICAL_ROLLBACK_CHAIN = Object.freeze({
  v132: 'local_source_candidate',
  v131: 'immediate_rollback',
  v130: 'secondary_rollback',
  v129: 'emergency_legacy_rollback',
  v128: 'blocking_compatibility',
  v127: 'readable_compatibility',
});

const LANE_VERSIONS = Object.freeze({
  'immediate-secondary': ['v131', 'v130'],
  emergency: ['v129'],
  'blocking-readable': ['v128', 'v127'],
  all: ['v131', 'v130', 'v129', 'v128', 'v127'],
});
const VERSION_MARKERS = Object.freeze({ v131: 'v1.3.1', v130: 'v1.3.0', v129: 'v1.2.9', v128: 'v1.2.8', v127: 'v1.2.7' });

export function runV132CompatibilityCheck({ repoRoot = process.cwd(), lane = 'all' } = {}) {
  const root = path.resolve(repoRoot);
  const policy = loadV132Policy(root);
  const source = readJsonStrict(path.join(root, 'CODEX_SOURCE_HARNESS_MANIFEST.json'));
  const docs = readJsonStrict(path.join(root, 'docs/process/CODEX_HARNESS_MANIFEST.json'));
  const index = readJsonStrict(path.join(root, 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json'));
  const reasons = [];
  const compatibilityEvidence = [];
  const versions = LANE_VERSIONS[lane] || [];
  if (!versions.length) reasons.push('compatibility_lane_invalid');
  const manifests = [source, docs, index];
  for (const manifest of manifests) {
    if (manifest.activeHarnessVersion !== '1.3.2') reasons.push('compatibility_active_v132_missing');
    if (manifest.activeSelfTestSuite !== 'v132') reasons.push('compatibility_active_suite_v132_missing');
    if (manifest.authorityCreated !== false) reasons.push('compatibility_authority_created');
    for (const version of versions) {
      if (manifest.versionAuthority?.[version] !== V132_CANONICAL_ROLLBACK_CHAIN[version]) reasons.push(`${version}_role_mismatch`);
    }
  }
  for (const version of versions) {
    const numeric = version.slice(1);
    const selfTest = path.join(root, 'scripts', `codex-v${numeric}-self-test.mjs`);
    let sourcePresent = false;
    let sourceDigest = null;
    let markerValid = false;
    if (!fs.existsSync(selfTest)) reasons.push(`${version}_historical_self_test_missing`);
    else {
      const text = fs.readFileSync(selfTest, 'utf8');
      const expectedMarker = `CODEX_QUALITY_HARNESS_FILE ${VERSION_MARKERS[version]}`;
      sourcePresent = true;
      sourceDigest = sha256(text);
      markerValid = text.includes(expectedMarker);
      if (!markerValid) reasons.push(`${version}_historical_self_test_marker_mismatch`);
    }
    const projectionValid = manifests.every((manifest) => manifest.versionAuthority?.[version] === V132_CANONICAL_ROLLBACK_CHAIN[version]);
    const behavior = runV132CompatibilityBehaviorInvariants({ version, policy, repoRoot: root });
    const behaviorInvariantResults = behavior.invariants;
    const behaviorInvariantsPassed = behavior.status === 'pass';
    if (!projectionValid) reasons.push(`${version}_projection_invalid`);
    if (!behaviorInvariantsPassed) reasons.push(`${version}_behavior_invariant_failed`);
    compatibilityEvidence.push({
      version,
      sourcePresent: sourcePresent && markerValid,
      sourceDigest,
      projectionValid,
      behaviorInvariantsPassed,
      behaviorInvariantCount: behaviorInvariantResults.length,
      behaviorInvariantDigest: sha256(canonicalJson(behaviorInvariantResults)),
      failedBehaviorInvariantIds: behaviorInvariantResults.filter((result) => result.status !== 'pass')
        .map((result) => result.invariantId),
      executionMode: behavior.executionMode,
    });
  }
  const adapter = source.compatibilityAdapter;
  if (adapter?.createsAuthority !== false || adapter?.affectsFinalDecision !== false) reasons.push('compatibility_adapter_authority_invalid');
  if (source.targetMutationCount !== 0) reasons.push('compatibility_target_mutation_detected');
  const sourcePresentStatus = compatibilityEvidence.every((entry) => entry.sourcePresent) ? 'pass' : 'fail';
  const projectionValidStatus = compatibilityEvidence.every((entry) => entry.projectionValid) ? 'pass' : 'fail';
  const behaviorInvariantsStatus = compatibilityEvidence.every((entry) => entry.behaviorInvariantsPassed) ? 'pass' : 'fail';
  return {
    schemaVersion: '1.3.2',
    lane,
    status: reasons.length ? 'fail' : 'pass',
    checkedVersions: versions,
    rollbackChain: V132_CANONICAL_ROLLBACK_CHAIN,
    historicalSelfTestsExecutedAsActiveTuple: false,
    sourcePresentStatus,
    projectionValidStatus,
    behaviorInvariantsStatus,
    compatibilityEvidence,
    compatibilityProjectionChecked: true,
    boundedBehaviorInvariantsExecuted: true,
    reasonCodes: [...new Set(reasons)],
    authorityCreated: false,
    targetMutationCount: 0,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const lane = process.argv.find((arg) => arg.startsWith('--lane='))?.slice(7) || 'all';
  const report = runV132CompatibilityCheck({ lane });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'pass' ? 0 : 1;
}
