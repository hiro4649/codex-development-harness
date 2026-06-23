#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCapabilityRegistry } from './codex-v129-capability-router.mjs';
import {
  canonicalJson,
  parseJsonRejectDuplicateKeys,
  sha256,
} from './codex-v129-goal-contract.mjs';

function loadTrustedAuthorityEvidence(env = process.env) {
  if (!env.CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_JSON) return { status: 'fail', reasonCodes: ['trusted_authority_evidence_missing'] };
  if (!env.CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_DIGEST) return { status: 'fail', reasonCodes: ['trusted_authority_evidence_digest_missing'] };
  try {
    const evidence = parseJsonRejectDuplicateKeys(env.CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_JSON);
    const digest = `sha256:${sha256(canonicalJson(evidence))}`;
    if (digest !== env.CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_DIGEST) {
      return { status: 'fail', reasonCodes: ['trusted_authority_evidence_digest_mismatch'], evidenceDigest: digest };
    }
    const allowed = new Set(['schemaVersion', 'repositoryId', 'goalDigest', 'candidateHeadSha', 'authorizedTaskClass', 'expiry', 'authorityEpoch']);
    const unknown = Object.keys(evidence).filter((key) => !allowed.has(key));
    if (unknown.length) return { status: 'fail', reasonCodes: unknown.map((key) => `trusted_authority_unknown_field_${key}`), evidenceDigest: digest };
    if (evidence.schemaVersion !== '1.2.9') return { status: 'fail', reasonCodes: ['trusted_authority_schema_invalid'], evidenceDigest: digest };
    if (!Number.isInteger(evidence.repositoryId) || evidence.repositoryId < 1) return { status: 'fail', reasonCodes: ['trusted_authority_repository_id_invalid'], evidenceDigest: digest };
    if (!/^sha256:[a-f0-9]{64}$/.test(String(evidence.goalDigest || ''))) return { status: 'fail', reasonCodes: ['trusted_authority_goal_digest_invalid'], evidenceDigest: digest };
    if (!/^[a-f0-9]{40}$/.test(String(evidence.candidateHeadSha || ''))) return { status: 'fail', reasonCodes: ['trusted_authority_candidate_head_invalid'], evidenceDigest: digest };
    if (typeof evidence.authorizedTaskClass !== 'string') return { status: 'fail', reasonCodes: ['trusted_authority_task_class_invalid'], evidenceDigest: digest };
    if (!Number.isInteger(evidence.authorityEpoch) || evidence.authorityEpoch < 1) return { status: 'fail', reasonCodes: ['trusted_authority_epoch_invalid'], evidenceDigest: digest };
    const expiryMs = Date.parse(evidence.expiry || '');
    if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) return { status: 'fail', reasonCodes: ['trusted_authority_expired'], evidenceDigest: digest };
    return { status: 'pass', evidence, reasonCodes: [] };
  } catch (error) {
    return { status: 'fail', reasonCodes: ['trusted_authority_evidence_malformed', String(error.message || error)] };
  }
}

function defensiveScopeAuthorized(classification, env = process.env) {
  const loaded = loadTrustedAuthorityEvidence(env);
  if (loaded.status !== 'pass') return loaded;
  const evidence = loaded.evidence;
  const authorized = evidence.repositoryId === classification.repositoryId
    && evidence.goalDigest === classification.goalDigest
    && evidence.candidateHeadSha === classification.candidateHeadSha
    && evidence.authorizedTaskClass === classification.taskClass;
  return {
    status: authorized ? 'pass' : 'fail',
    reasonCodes: authorized ? [] : ['plugin_defensive_scope_missing'],
  };
}

export function selectPlugins(classification = {}, routeDecision = {}, env = process.env) {
  const loaded = loadCapabilityRegistry(env);
  if (loaded.status !== 'pass') {
    return {
      schemaVersion: '1.2.9',
      status: loaded.status,
      reasonCodes: loaded.reasonCodes,
      selectedPluginIds: [],
      pluginInvocationAllowed: false,
      safeSummaryOnly: true,
    };
  }
  const reasonCodes = [];
  const taskClass = classification.taskClass;
  const eligible = new Set(routeDecision.eligiblePlugins || []);
  const plugins = loaded.registry.plugins || [];
  const derived = ['security_scan', 'security_remediation'].includes(taskClass)
    ? plugins.filter((plugin) => eligible.has(plugin.pluginId) && plugin.authorizedTaskClasses.includes(taskClass)).map((plugin) => plugin.pluginId).slice(0, 1)
    : [];
  if (!derived.length) {
    return {
      schemaVersion: '1.2.9',
      status: 'pass',
      reasonCodes: [],
      selectedPluginIds: [],
      pluginInvocationAllowed: false,
      pluginSelectionState: 'none',
      safeSummaryOnly: true,
    };
  }
  if (!['security_scan', 'security_remediation'].includes(taskClass)) reasonCodes.push('routine_plugin_misuse');
  const selected = [];
  for (const pluginId of derived) {
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    if (!plugin) {
      reasonCodes.push('plugin_unavailable');
      continue;
    }
    if (plugin.availabilityState !== 'available') reasonCodes.push('plugin_unavailable');
    if (plugin.authorizationState !== 'authorized') reasonCodes.push('plugin_not_authorized');
    if (!eligible.has(pluginId) || !plugin.authorizedTaskClasses.includes(taskClass)) {
      reasonCodes.push('plugin_not_authorized');
      continue;
    }
    if (plugin.requiresDefensiveScope) {
      const scope = defensiveScopeAuthorized(classification, env);
      if (scope.status !== 'pass') {
        reasonCodes.push(...scope.reasonCodes);
        continue;
      }
    }
    if (classification.secretAccessRequired || classification.deployAuthorityRequired || classification.rawLogRequired) {
      reasonCodes.push('plugin_forbidden_authority_requested');
      continue;
    }
    selected.push(pluginId);
  }
  if (selected.length > 1) reasonCodes.push('plugin_invocation_count_exceeded');
  return {
    schemaVersion: '1.2.9',
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    selectedPluginIds: selected,
    pluginInvocationAllowed: selected.length > 0 && reasonCodes.length === 0,
    pluginSelectionState: selected.length ? 'selected' : 'unavailable',
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : JSON.parse(fs.readFileSync(0, 'utf8'));
  const report = selectPlugins(input.classification || input, input.routeDecision || {});
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
