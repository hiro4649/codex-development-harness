#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonicalJson, sha256 } from './codex-v129-goal-contract.mjs';

export function digestFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

export function buildDispatchRequest(input = {}) {
  return {
    schemaVersion: '1.2.9',
    runId: input.runId || 'run-v129-fixture',
    goalDigest: input.goalDigest,
    classificationDigest: input.classificationDigest,
    routeDecisionDigest: input.routeDecisionDigest,
    capabilityClass: input.capabilityClass,
    resolvedModelRef: input.resolvedModelRef,
    pluginRefs: input.pluginRefs || [],
    inputDigest: input.inputDigest || `sha256:${sha256(canonicalJson(input.safeInput || {}))}`,
    inputBytes: Number(input.inputBytes ?? Buffer.byteLength(canonicalJson(input.safeInput || {}), 'utf8')),
    maxOutputBytes: Number(input.maxOutputBytes || 4096),
    workspaceDigest: input.workspaceDigest || `sha256:${'0'.repeat(64)}`,
    authority: 'none',
  };
}

export function validateInvocationReceipt(receipt = {}, context = {}) {
  const reasonCodes = [];
  if (receipt.schemaVersion !== '1.2.9') reasonCodes.push('receipt_schema_invalid');
  for (const key of ['runId', 'goalDigest', 'routeDecisionDigest', 'registryDigest', 'hostAdapterDigest', 'capabilityClass', 'resolvedModelId', 'inputDigest']) {
    if (!receipt[key]) reasonCodes.push(`receipt_${key}_missing`);
  }
  if (receipt.authorityCreated !== false) reasonCodes.push('authority_created_forbidden');
  if (receipt.modelInvocationObserved === true && !receipt.resolvedModelId) reasonCodes.push('fake_model_invocation');
  if (receipt.pluginInvocationObserved === true && !receipt.pluginResultDigest) reasonCodes.push('fake_plugin_invocation');
  if ((receipt.selectedPluginIds || []).length > 1) reasonCodes.push('plugin_invocation_count_exceeded');
  if (receipt.fixture === true && context.production === true) reasonCodes.push('fixture_in_production');
  if (context.expectedGoalDigest && receipt.goalDigest !== context.expectedGoalDigest) reasonCodes.push('receipt_goal_digest_mismatch');
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    safeSummaryOnly: true,
  };
}

export function dispatchHost(request, env = process.env) {
  const adapterPath = env.CODEX_V129_HOST_ADAPTER_PATH;
  const trustedDigest = env.CODEX_V129_TRUSTED_HOST_ADAPTER_DIGEST;
  const reasonCodes = [];
  if (!adapterPath) reasonCodes.push('host_adapter_missing');
  if (adapterPath && !path.isAbsolute(adapterPath)) reasonCodes.push('host_adapter_path_relative');
  if (adapterPath && !fs.existsSync(adapterPath)) reasonCodes.push('host_adapter_missing');
  let adapterDigest = null;
  if (adapterPath && fs.existsSync(adapterPath)) {
    adapterDigest = digestFile(adapterPath);
    if (trustedDigest && trustedDigest !== adapterDigest) reasonCodes.push('host_adapter_digest_mismatch');
  }
  if (reasonCodes.length) {
    return {
      schemaVersion: '1.2.9',
      status: 'fail',
      reasonCodes,
      hostAdapterDigest: adapterDigest,
      authorityCreated: false,
      safeSummaryOnly: true,
    };
  }
  const stdout = execFileSync(process.execPath, [adapterPath], {
    input: `${JSON.stringify(request)}\n`,
    encoding: 'utf8',
    maxBuffer: Math.max(1024 * 1024, Number(request.maxOutputBytes || 4096) * 4),
  });
  let receipt;
  try {
    receipt = JSON.parse(stdout);
  } catch {
    return { schemaVersion: '1.2.9', status: 'fail', reasonCodes: ['malformed_receipt'], authorityCreated: false, safeSummaryOnly: true };
  }
  const validation = validateInvocationReceipt(receipt, {
    expectedGoalDigest: request.goalDigest,
    production: env.CODEX_V129_TEST_MODE !== '1',
  });
  return {
    schemaVersion: '1.2.9',
    status: validation.status,
    reasonCodes: validation.reasonCodes,
    invocationReceipt: receipt,
    hostAdapterDigest: adapterDigest,
    authorityCreated: false,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const request = buildDispatchRequest(JSON.parse(fs.readFileSync(0, 'utf8') || '{}'));
  const report = dispatchHost(request);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
