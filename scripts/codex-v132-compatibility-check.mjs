#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJsonStrict } from './codex-v132-manifest-compiler.mjs';
import { canonicalJson, sha256 } from './codex-v132-evidence-truth.mjs';

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

export const V132_COMPATIBILITY_INVARIANT_CONTRACT = Object.freeze({
  common: [
    'v132_active_tuple',
    'final_decision_authority_preserved',
    'compatibility_adapter_internal_only',
    'performance_track_deferred',
    'target_rollout_not_started',
    'authority_not_created',
    'target_product_not_mutated',
  ],
  v131: ['immediate_rollback_role'],
  v130: ['secondary_rollback_role', 'machine_aliases_preserved', 'target_overlay_projection_only'],
  v129: ['emergency_rollback_role', 'immediate_rollback_alias_preserved'],
  v128: ['blocking_compatibility_role', 'rollback_compatibility_alias_preserved'],
  v127: ['readable_compatibility_role', 'readable_compatibility_alias_preserved'],
});

function invariantResult(invariantId, passed) {
  return { invariantId, status: passed ? 'pass' : 'fail' };
}

function runBehaviorInvariants(manifest, version) {
  const adapter = manifest.compatibilityAdapter || {};
  const v130Adapter = adapter.v130CompatibilityAdapter || {};
  const roleInvariantIds = {
    v131: 'immediate_rollback_role',
    v130: 'secondary_rollback_role',
    v129: 'emergency_rollback_role',
    v128: 'blocking_compatibility_role',
    v127: 'readable_compatibility_role',
  };
  const results = [
    invariantResult('v132_active_tuple', manifest.activeHarnessVersion === '1.3.2' && manifest.activeSelfTestSuite === 'v132'),
    invariantResult('final_decision_authority_preserved', manifest.finalAuthority === 'v1.1.8_final_decision_kernel'),
    invariantResult('compatibility_adapter_internal_only', adapter.state === 'active' && adapter.authority === 'internal_compatibility_only'
      && adapter.createsAuthority === false && adapter.affectsFinalDecision === false && adapter.affectsTargetRollout === false),
    invariantResult('performance_track_deferred', manifest.performanceTrack?.state === 'deferred'
      && manifest.performanceTrack?.superiorityClaimState === 'not_proven'),
    invariantResult('target_rollout_not_started', (manifest.targetRolloutState || manifest.targetRollout) === 'not_started'),
    invariantResult('authority_not_created', manifest.authorityCreated === false),
    invariantResult('target_product_not_mutated', manifest.targetMutationCount === 0),
    invariantResult(roleInvariantIds[version], manifest.versionAuthority?.[version] === V132_CANONICAL_ROLLBACK_CHAIN[version]),
  ];
  if (version === 'v130') {
    results.push(invariantResult('machine_aliases_preserved', adapter.machineAliasesPreserved === true));
    results.push(invariantResult('target_overlay_projection_only', manifest.targetManifestOverlay?.projectionKind === 'profile_install_template_only'
      && manifest.targetManifestOverlay?.mutatesTargetRepositories === false));
  }
  if (version === 'v129') results.push(invariantResult('immediate_rollback_alias_preserved', v130Adapter.immediateRollback === 'preserved'));
  if (version === 'v128') results.push(invariantResult('rollback_compatibility_alias_preserved', v130Adapter.rollbackCompatibility === 'preserved'));
  if (version === 'v127') results.push(invariantResult('readable_compatibility_alias_preserved', v130Adapter.readableCompatibility === 'preserved'));
  const expectedIds = [...V132_COMPATIBILITY_INVARIANT_CONTRACT.common, ...V132_COMPATIBILITY_INVARIANT_CONTRACT[version]];
  for (const invariantId of expectedIds) {
    if (!results.some((result) => result.invariantId === invariantId)) results.push(invariantResult(`contract_missing:${invariantId}`, false));
  }
  return results;
}

export function runV132CompatibilityCheck({ repoRoot = process.cwd(), lane = 'all' } = {}) {
  const root = path.resolve(repoRoot);
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
    const behaviorInvariantResults = manifests.flatMap((manifest, manifestIndex) => runBehaviorInvariants(manifest, version)
      .map((result) => ({ ...result, manifest: ['source', 'docs', 'active_policy'][manifestIndex] })));
    const behaviorInvariantsPassed = behaviorInvariantResults.every((result) => result.status === 'pass');
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
        .map((result) => `${result.manifest}:${result.invariantId}`),
      executionMode: 'bounded_invariants_under_v132_active_tuple',
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
