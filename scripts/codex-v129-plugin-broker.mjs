#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import fs from 'node:fs';
import { loadCapabilityRegistry } from './codex-v129-capability-router.mjs';

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
  const requested = classification.requestedPlugins || [];
  const eligible = new Set(routeDecision.eligiblePlugins || []);
  const plugins = loaded.registry.plugins || [];
  if (!requested.length) {
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
  if (requested.length > 1) reasonCodes.push('plugin_invocation_count_exceeded');
  if (!['security_scan', 'security_remediation'].includes(taskClass)) reasonCodes.push('routine_plugin_misuse');
  const selected = [];
  for (const pluginId of requested.slice(0, 1)) {
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    if (!plugin) {
      reasonCodes.push('plugin_unavailable');
      continue;
    }
    if (!eligible.has(pluginId) || !plugin.authorizedTaskClasses.includes(taskClass)) {
      reasonCodes.push('plugin_not_authorized');
      continue;
    }
    if (plugin.requiresDefensiveScope && classification.authorizedDefensiveScope !== true) {
      reasonCodes.push('plugin_defensive_scope_missing');
      continue;
    }
    if (classification.secretAccessRequired || classification.deployAuthorityRequired || classification.rawLogRequired) {
      reasonCodes.push('plugin_forbidden_authority_requested');
      continue;
    }
    selected.push(pluginId);
  }
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : JSON.parse(fs.readFileSync(0, 'utf8'));
  const report = selectPlugins(input.classification || input, input.routeDecision || {});
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
