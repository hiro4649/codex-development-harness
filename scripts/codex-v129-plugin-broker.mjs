#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCapabilityRegistry } from './codex-v129-capability-router.mjs';

function loadTrustedAuthorityEvidence(env = process.env) {
  if (!env.CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_JSON) return { status: 'fail', reasonCodes: ['trusted_authority_evidence_missing'] };
  try {
    const evidence = JSON.parse(env.CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_JSON);
    return { status: 'pass', evidence, reasonCodes: [] };
  } catch {
    return { status: 'fail', reasonCodes: ['trusted_authority_evidence_malformed'] };
  }
}

function defensiveScopeAuthorized(goalDigest, env = process.env) {
  const loaded = loadTrustedAuthorityEvidence(env);
  if (loaded.status !== 'pass') return loaded;
  const authorized = Array.isArray(loaded.evidence.authorizedDefensiveGoalDigests)
    && loaded.evidence.authorizedDefensiveGoalDigests.includes(goalDigest);
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
      const scope = defensiveScopeAuthorized(classification.goalDigest, env);
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
