#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from './codex-v129-goal-contract.mjs';
import { digestFile } from './codex-v129-host-dispatch.mjs';

const request = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const output = {
  fixture: true,
  observed: true,
  requestDigest: `sha256:${sha256(canonicalJson(request))}`,
};

const receipt = {
  schemaVersion: '1.2.9',
  runId: request.runId,
  goalDigest: request.goalDigest,
  classificationDigest: request.classificationDigest,
  routeDecisionDigest: request.routeDecisionDigest,
  registryDigest: request.registryDigest,
  hostAdapterDigest: digestFile(fileURLToPath(import.meta.url)),
  capabilityClass: request.capabilityClass,
  resolvedModelId: request.resolvedModelRef || 'fixture:model',
  modelInvocationObserved: true,
  modelInputBytes: request.inputBytes || 0,
  modelOutputBytes: Buffer.byteLength(canonicalJson(output), 'utf8'),
  modelOutputDigest: `sha256:${sha256(canonicalJson(output))}`,
  selectedPluginIds: request.pluginRefs || [],
  pluginRefs: request.pluginRefs || [],
  pluginInvocationObserved: Boolean((request.pluginRefs || []).length),
  pluginResultDigest: (request.pluginRefs || []).length ? `sha256:${'2'.repeat(64)}` : null,
  workerOutputDigest: `sha256:${sha256(canonicalJson(output))}`,
  inputDigest: request.inputDigest,
  inputBytes: request.inputBytes,
  maxOutputBytes: request.maxOutputBytes,
  workspaceDigest: request.workspaceDigest,
  fixture: true,
  authorityCreated: false,
};

process.stdout.write(`${JSON.stringify(receipt)}\n`);
