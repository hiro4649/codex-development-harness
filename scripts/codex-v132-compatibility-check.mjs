#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJsonStrict } from './codex-v132-manifest-compiler.mjs';

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

export function runV132CompatibilityCheck({ repoRoot = process.cwd(), lane = 'all' } = {}) {
  const root = path.resolve(repoRoot);
  const source = readJsonStrict(path.join(root, 'CODEX_SOURCE_HARNESS_MANIFEST.json'));
  const docs = readJsonStrict(path.join(root, 'docs/process/CODEX_HARNESS_MANIFEST.json'));
  const index = readJsonStrict(path.join(root, 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json'));
  const reasons = [];
  const versions = LANE_VERSIONS[lane] || [];
  if (!versions.length) reasons.push('compatibility_lane_invalid');
  for (const manifest of [source, docs, index]) {
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
    if (!fs.existsSync(selfTest)) reasons.push(`${version}_historical_self_test_missing`);
  }
  const adapter = source.compatibilityAdapter;
  if (adapter?.createsAuthority !== false || adapter?.affectsFinalDecision !== false) reasons.push('compatibility_adapter_authority_invalid');
  if (source.targetMutationCount !== 0) reasons.push('compatibility_target_mutation_detected');
  return {
    schemaVersion: '1.3.2',
    lane,
    status: reasons.length ? 'fail' : 'pass',
    checkedVersions: versions,
    rollbackChain: V132_CANONICAL_ROLLBACK_CHAIN,
    historicalSelfTestsExecutedAsActiveTuple: false,
    compatibilityProjectionChecked: true,
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

