#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { canonicalJson, sha256 } from './codex-v132-evidence-truth.mjs';

function parseArgs(argv) {
  return Object.fromEntries(argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...parts] = arg.slice(2).split('=');
    return [key, parts.join('=') || true];
  }));
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function percentile50(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function runGate(repoRoot, expectedVersion) {
  const started = process.hrtime.bigint();
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      CODEX_HARNESS_SOURCE_REPO: '1',
      CODEX_HARNESS_MODE: 'core',
      CODEX_PROFILE_COMPAT_MODE: 'optional',
      CODEX_QUALITY_REPORT: 'json',
      CODEX_REQUIRE_NPM: '1',
      CODEX_V132_DIAGNOSTICS: '0',
      CODEX_V132_RESUME_RECEIPT_FILE: '',
    },
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (result.status !== 0) throw new Error(`${expectedVersion}_gate_failed:${String(result.stderr || result.stdout).slice(-500)}`);
  const report = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
  const activeStatus = expectedVersion === '1.3.2' ? report.v132SelfTestStatus?.status : report.v131SelfTestStatus?.status;
  if (report.status !== 'pass' || activeStatus !== 'pass') throw new Error(`${expectedVersion}_invariant_gate_not_pass`);
  return {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    outputBytes: Buffer.byteLength(result.stdout.trim(), 'utf8'),
    selectedNodes: report.selectedNodeCount ?? null,
    executedNodes: report.executedNodeCount ?? null,
    reusedNodes: report.reusedNodeCount ?? null,
    activeSelfTestStatus: activeStatus,
    validationCoverageDigest: report.validationCoverage?.coverageDigest || null,
    validationCoverageNodeCount: report.validationCoverage?.nodeCount ?? null,
    validationCoverageDerivedFromOutputDigests: report.validationCoverage?.derivation === 'executed_or_attested_node_output_digests',
  };
}

function measure(repoRoot, expectedVersion, warmupCount, measuredRunCount) {
  const warmups = Array.from({ length: warmupCount }, () => runGate(repoRoot, expectedVersion));
  const measured = Array.from({ length: measuredRunCount }, () => runGate(repoRoot, expectedVersion));
  const coverageDigests = [...new Set(measured.map((run) => run.validationCoverageDigest).filter(Boolean))];
  return {
    repositoryRootDigest: sha256(path.resolve(repoRoot)),
    headSha: git(repoRoot, ['rev-parse', 'HEAD']),
    warmupCount,
    measuredRunCount,
    warmups,
    measured,
    p50Ms: percentile50(measured.map((run) => run.elapsedMs)),
    p50OutputBytes: percentile50(measured.map((run) => run.outputBytes)),
    coverageAttestation: {
      state: coverageDigests.length === 1 && measured.every((run) => run.validationCoverageDerivedFromOutputDigests)
        ? 'attested_from_executed_output_digests'
        : 'not_attested_from_executed_output_digests',
      coverageDigest: coverageDigests.length === 1 ? coverageDigests[0] : null,
      observedDigestCount: coverageDigests.length,
    },
  };
}

export function runComparableBenchmark({ baselineRoot, candidateRoot = process.cwd(), warmupCount = 1, measuredRunCount = 5 } = {}) {
  if (!baselineRoot) throw new Error('baseline_root_required');
  const baseline = measure(path.resolve(baselineRoot), '1.3.1', warmupCount, measuredRunCount);
  const candidate = measure(path.resolve(candidateRoot), '1.3.2', warmupCount, measuredRunCount);
  const comparableCoverage = baseline.coverageAttestation.state === 'attested_from_executed_output_digests'
    && candidate.coverageAttestation.state === 'attested_from_executed_output_digests'
    && baseline.coverageAttestation.coverageDigest === candidate.coverageAttestation.coverageDigest;
  const outputReductionPercent = baseline.p50OutputBytes
    ? Number(((1 - candidate.p50OutputBytes / baseline.p50OutputBytes) * 100).toFixed(4))
    : null;
  return {
    schemaVersion: '1.3.2',
    benchmarkType: 'same_machine_output_and_coverage_attested_runs',
    machineProfile: { platform: process.platform, arch: process.arch, release: os.release(), cpuCount: os.cpus().length, totalMemoryBytes: os.totalmem() },
    nodeVersion: process.version,
    baseSha: baseline.headSha,
    headSha: candidate.headSha,
    coverageComparison: {
      state: comparableCoverage ? 'equivalent_executed_output_digest_coverage' : 'not_comparable',
      baselineDigest: baseline.coverageAttestation.coverageDigest,
      candidateDigest: candidate.coverageAttestation.coverageDigest,
      derivedFromExecutedOutputDigests: true,
    },
    baseline,
    candidate,
    outputSizeReduction: { state: 'proven_same_command_output_boundary', percent: outputReductionPercent },
    relativePerformanceClaimState: comparableCoverage ? 'not_proven_until_remote_equivalent_coverage' : 'not_proven_missing_equivalent_executed_coverage',
    superiorityClaimState: 'not_proven',
    authorityCreated: false,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const args = parseArgs(process.argv);
  const result = runComparableBenchmark({
    baselineRoot: args['baseline-root'],
    candidateRoot: args['candidate-root'] || process.cwd(),
    warmupCount: Number(args.warmups || 1),
    measuredRunCount: Number(args.runs || 5),
  });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) fs.writeFileSync(path.resolve(String(args.output)), serialized, 'utf8');
  process.stdout.write(serialized);
}
