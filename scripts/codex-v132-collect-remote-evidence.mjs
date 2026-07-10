#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  collectAcceptedMainTrustRoot,
  collectVerifiedGithubEvidence,
  evaluateRemoteEvidence,
  V132_SOURCE_REPOSITORY,
  V132_VERSION,
} from './codex-v132-evidence-truth.mjs';

function option(name, argv) {
  return argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function runIdsFromArgs(argv) {
  const values = argv.flatMap((arg) => {
    if (arg.startsWith('--run-id=')) return [arg.slice(9)];
    if (arg.startsWith('--run-ids=')) return arg.slice(10).split(',');
    return [];
  });
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function writeAtomicJson(file, value) {
  const target = path.resolve(file);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(target)) throw new Error('collector_output_already_exists');
  const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, target);
    try { fs.chmodSync(target, 0o600); } catch { /* Windows ACLs remain owner-managed. */ }
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  return target;
}

export async function runCollectorCli({
  argv = process.argv.slice(2),
  env = process.env,
  httpClient = null,
} = {}) {
  const repository = option('repository', argv) || V132_SOURCE_REPOSITORY;
  const pullRequestNumber = Number(option('pull-request', argv));
  const runIds = runIdsFromArgs(argv);
  const output = option('output', argv);
  const expectedDefaultBranchHeadSha = option('expected-main-head', argv) || undefined;
  const token = env.CODEX_V132_COLLECTOR_TOKEN;
  if (!token) throw new Error('owner_managed_collector_credential_required');
  if (!output) throw new Error('collector_output_path_required');
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) throw new Error('collector_pull_request_required');

  const trustRoot = await collectAcceptedMainTrustRoot({
    repository,
    expectedDefaultBranchHeadSha,
    token,
    httpClient,
  });

  const receipt = await collectVerifiedGithubEvidence({
    repository,
    pullRequestNumber,
    runIds,
    token,
    acceptedMainTrustRoot: trustRoot,
    httpClient,
  });
  const testMode = trustRoot.trustSource === 'github_api_mock_fixture';
  const evaluation = evaluateRemoteEvidence(receipt, {
    repository,
    pullRequestNumber,
    event: 'pull_request',
    baseSha: receipt.pullRequestBinding.baseSha,
    headSha: receipt.pullRequestBinding.headSha,
    acceptedMainTrustRoot: trustRoot,
    testMode,
  });
  const evaluatedRemoteValidationState = evaluation.remoteValidationState;
  const passed = evaluation.status === 'pass' && evaluatedRemoteValidationState === 'passed';
  const unavailable = ['unavailable_billing', 'unavailable_pre_runner'].includes(evaluatedRemoteValidationState);
  const pending = ['queued', 'in_progress'].includes(evaluatedRemoteValidationState);
  const terminalNonPass = ['canceled', 'failed'].includes(evaluatedRemoteValidationState);
  const remoteValidationState = passed || unavailable || pending || terminalNonPass
    ? evaluatedRemoteValidationState
    : 'failed';

  const serialized = {
    schemaVersion: V132_VERSION,
    evidenceType: 'serialized_remote_evidence_receipt',
    authority: 'none',
    createsAuthority: false,
    finalDecisionAuthorityCreated: false,
    mergeAllowed: false,
    remoteValidationState,
    trustObservation: {
      repository: trustRoot.trustSourceRepository,
      defaultBranch: trustRoot.trustSourceDefaultBranch,
      headSha: trustRoot.trustSourceHeadSha,
      blobSha: trustRoot.trustSourceBlobSha,
      path: trustRoot.trustSourcePath,
      effectiveTrustRootDigest: trustRoot.effectiveTrustRootDigest,
      observedAt: trustRoot.observedAt,
    },
    receipt,
  };
  const outputPath = writeAtomicJson(output, serialized);
  return {
    status: passed ? 'pass' : unavailable || pending ? 'unavailable' : 'fail',
    exitCode: passed ? 0 : unavailable || pending ? 2 : 1,
    remoteValidationState,
    repository,
    headSha: receipt.headSha,
    runIds: receipt.runIds,
    outputFile: path.basename(outputPath),
    receiptPayloadDigest: receipt.receiptPayloadDigest,
    createsAuthority: false,
    mergeAllowed: false,
    finalDecisionAuthorityCreated: false,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runCollectorCli();
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(JSON.stringify({
      status: 'fail',
      reason: String(error?.message || error).slice(0, 512),
      createsAuthority: false,
    }));
    process.exitCode = 1;
  }
}
