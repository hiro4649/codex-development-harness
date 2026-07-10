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

function option(name) {
  return process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
}

function runIdsFromArgs() {
  const values = process.argv.slice(2).flatMap((arg) => {
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

export async function runCollectorCli() {
  const repository = option('repository') || V132_SOURCE_REPOSITORY;
  const runIds = runIdsFromArgs();
  const output = option('output');
  const expectedDefaultBranchHeadSha = option('expected-main-head') || undefined;
  const token = process.env.CODEX_V132_COLLECTOR_TOKEN;
  if (!token) throw new Error('owner_managed_collector_credential_required');
  if (!output) throw new Error('collector_output_path_required');
  if (!runIds.length) throw new Error('collector_run_ids_required');

  const trustRoot = await collectAcceptedMainTrustRoot({
    repository,
    expectedDefaultBranchHeadSha,
    token,
  });
  const requiredWorkflowCount = trustRoot.document.workflowContract.requiredWorkflows.length;
  if (runIds.length < requiredWorkflowCount) throw new Error('collector_required_workflow_run_omitted');

  const receipt = await collectVerifiedGithubEvidence({
    repository,
    runIds,
    token,
    acceptedMainTrustRoot: trustRoot,
  });
  const evaluation = evaluateRemoteEvidence(receipt, {
    repository,
    pullRequestNumber: receipt.pullRequestNumber,
    event: 'pull_request',
    baseSha: receipt.baseSha,
    headSha: receipt.headSha,
    acceptedMainTrustRoot: trustRoot,
  });
  if (evaluation.status !== 'pass' || evaluation.remoteValidationState !== 'passed') {
    throw new Error(`collector_remote_evidence_invalid:${evaluation.reasonCodes.join(',')}`);
  }

  const serialized = {
    schemaVersion: V132_VERSION,
    evidenceType: 'serialized_remote_evidence_receipt',
    authority: 'none',
    createsAuthority: false,
    finalDecisionAuthorityCreated: false,
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
    status: 'pass',
    repository,
    headSha: receipt.headSha,
    runIds: receipt.runIds,
    outputFile: path.basename(outputPath),
    receiptPayloadDigest: receipt.receiptPayloadDigest,
    createsAuthority: false,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runCollectorCli()));
  } catch (error) {
    console.error(JSON.stringify({
      status: 'fail',
      reason: String(error?.message || error).slice(0, 512),
      createsAuthority: false,
    }));
    process.exitCode = 1;
  }
}
