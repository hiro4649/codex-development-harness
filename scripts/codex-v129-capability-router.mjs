#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalJson,
  parseJsonRejectDuplicateKeys,
  sha256,
  V129_TASK_CLASSES,
} from './codex-v129-goal-contract.mjs';

export function digestRegistry(registry = {}) {
  return `sha256:${sha256(canonicalJson(registry))}`;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function unknownFields(value, allowedFields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const allowed = new Set(allowedFields);
  return Object.keys(value).filter((key) => !allowed.has(key));
}

export function validateCapabilityRegistry(registry = {}) {
  const reasonCodes = [];
  for (const field of unknownFields(registry, ['schemaVersion', 'registryId', 'capabilities', 'plugins', 'routes'])) reasonCodes.push(`registry_unknown_field_${field}`);
  if (registry.schemaVersion !== '1.2.9') reasonCodes.push('registry_schema_invalid');
  if (!Array.isArray(registry.capabilities)) reasonCodes.push('registry_capabilities_missing');
  if (!Array.isArray(registry.plugins)) reasonCodes.push('registry_plugins_missing');
  if (!registry.routes || typeof registry.routes !== 'object' || Array.isArray(registry.routes)) reasonCodes.push('registry_routes_missing');
  const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : [];
  const plugins = Array.isArray(registry.plugins) ? registry.plugins : [];
  const capabilityClasses = capabilities.map((item) => item.capabilityClass).filter(Boolean);
  const pluginIds = plugins.map((item) => item.pluginId).filter(Boolean);
  if (duplicateValues(capabilityClasses).length) reasonCodes.push('duplicate_capability_class');
  if (duplicateValues(pluginIds).length) reasonCodes.push('duplicate_plugin_id');
  const capabilitySet = new Set(capabilityClasses);
  const pluginSet = new Set(pluginIds);
  for (const capability of capabilities) {
    for (const field of unknownFields(capability, ['capabilityClass', 'resolvedModelRef', 'maxOutputBytes', 'availabilityState', 'authorizationState', 'costClass', 'fallbackChain'])) reasonCodes.push(`capability_unknown_field_${field}`);
    if (!capability.capabilityClass || typeof capability.capabilityClass !== 'string') reasonCodes.push('capability_class_missing');
    if (!capability.resolvedModelRef || typeof capability.resolvedModelRef !== 'string') reasonCodes.push('resolved_model_ref_missing');
    if (capability.resolvedModelId) reasonCodes.push('core_model_id_forbidden');
    if (!Number.isInteger(capability.maxOutputBytes) || capability.maxOutputBytes < 1) reasonCodes.push('max_output_bytes_invalid');
    if (!['available', 'unavailable'].includes(capability.availabilityState)) reasonCodes.push('availability_state_invalid');
    if (!['authorized', 'unauthorized'].includes(capability.authorizationState)) reasonCodes.push('authorization_state_invalid');
    if (!['low', 'standard', 'high', 'specialist'].includes(capability.costClass)) reasonCodes.push('cost_class_invalid');
    for (const fallback of capability.fallbackChain || []) {
      if (!capabilitySet.has(fallback)) reasonCodes.push('unknown_capability');
    }
  }
  for (const plugin of plugins) {
    for (const field of unknownFields(plugin, ['pluginId', 'authorizedTaskClasses', 'requiresDefensiveScope', 'availabilityState', 'authorizationState'])) reasonCodes.push(`plugin_unknown_field_${field}`);
    if (!plugin.pluginId || typeof plugin.pluginId !== 'string') reasonCodes.push('plugin_id_missing');
    if (!Array.isArray(plugin.authorizedTaskClasses)) reasonCodes.push('plugin_authorized_tasks_invalid');
    for (const taskClass of plugin.authorizedTaskClasses || []) {
      if (!V129_TASK_CLASSES.includes(taskClass)) reasonCodes.push('unknown_plugin_task_class');
    }
    if (!['available', 'unavailable'].includes(plugin.availabilityState)) reasonCodes.push('plugin_availability_state_invalid');
    if (!['authorized', 'unauthorized'].includes(plugin.authorizationState)) reasonCodes.push('plugin_authorization_state_invalid');
  }
  for (const [taskClass, route] of Object.entries(registry.routes || {})) {
    if (!V129_TASK_CLASSES.includes(taskClass)) reasonCodes.push('unknown_task_route');
    if (!route || typeof route !== 'object' || Array.isArray(route)) {
      reasonCodes.push('route_invalid');
      continue;
    }
    for (const field of unknownFields(route, ['requiredCapabilityClasses', 'fallbackChain', 'pluginDefault', 'eligiblePlugins'])) reasonCodes.push(`route_unknown_field_${field}`);
    if (!Array.isArray(route.requiredCapabilityClasses)) reasonCodes.push('route_required_capabilities_invalid');
    for (const capabilityClass of route.requiredCapabilityClasses || []) {
      if (!capabilitySet.has(capabilityClass)) reasonCodes.push('unknown_capability');
    }
    for (const capabilityClass of route.fallbackChain || []) {
      if (!capabilitySet.has(capabilityClass)) reasonCodes.push('unknown_capability');
    }
    if (!('pluginDefault' in route)) reasonCodes.push('route_plugin_default_missing');
    if (route.pluginDefault !== 'none' && !pluginSet.has(route.pluginDefault)) reasonCodes.push('unknown_plugin');
    for (const pluginId of route.eligiblePlugins || []) {
      if (!pluginSet.has(pluginId)) reasonCodes.push('unknown_plugin');
    }
  }
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes };
}

export function parseCapabilityRegistry(text) {
  const registry = parseJsonRejectDuplicateKeys(text);
  const validation = validateCapabilityRegistry(registry);
  if (validation.status !== 'pass') throw new Error(validation.reasonCodes.join(','));
  return registry;
}

export function loadCapabilityRegistry(env = process.env) {
  const text = env.CODEX_V129_CAPABILITY_REGISTRY_JSON;
  const trustedDigest = env.CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST;
  if (!text) return { status: 'fail', reasonCodes: ['registry_missing'] };
  if (!trustedDigest) return { status: 'fail', reasonCodes: ['trusted_registry_digest_missing'] };
  let registry;
  try {
    registry = parseCapabilityRegistry(text);
  } catch (error) {
    return { status: 'fail', reasonCodes: [String(error.message || error)] };
  }
  const registryDigest = digestRegistry(registry);
  if (trustedDigest !== registryDigest) {
    return { status: 'fail', reasonCodes: ['registry_digest_mismatch'], registryDigest };
  }
  return { status: 'pass', registry, registryDigest, reasonCodes: [] };
}

function capabilityByClass(registry, capabilityClass) {
  return (registry.capabilities || []).find((capability) => capability.capabilityClass === capabilityClass && capability.availabilityState === 'available' && capability.authorizationState === 'authorized');
}

export function routeCapability(classification = {}, env = process.env) {
  const loaded = loadCapabilityRegistry(env);
  if (loaded.status !== 'pass') {
    return {
      schemaVersion: '1.2.9',
      status: loaded.status,
      reasonCodes: loaded.reasonCodes,
      routeState: loaded.status === 'route_unavailable' ? 'route_unavailable' : 'blocked',
      authorityCreated: false,
      safeSummaryOnly: true,
    };
  }
  const { registry, registryDigest } = loaded;
  const route = registry.routes[classification.taskClass] || null;
  const required = route?.requiredCapabilityClasses || classification.requiredCapabilityClasses || [];
  const reasonCodes = [];
  if (!route) reasonCodes.push('unknown_task_route');
  const selectedCapabilities = [];
  for (const capabilityClass of required) {
    const capability = capabilityByClass(registry, capabilityClass);
    if (capability) {
      selectedCapabilities.push(capability);
    } else if (capabilityClass === 'independent_verifier') {
      reasonCodes.push('independent_verifier_required');
    } else {
      const fallbackClass = (route?.fallbackChain || []).find((fallback) => capabilityByClass(registry, fallback));
      if (fallbackClass) selectedCapabilities.push(capabilityByClass(registry, fallbackClass));
      else reasonCodes.push('capability_unavailable');
    }
  }
  if (required.includes('independent_verifier') && !selectedCapabilities.some((capability) => capability.capabilityClass === 'independent_verifier')) reasonCodes.push('independent_verifier_required');
  const selectedCapability = selectedCapabilities[0] || null;
  const routeDecision = {
    schemaVersion: '1.2.9',
    taskClass: classification.taskClass || null,
    difficulty: classification.difficulty || null,
    registryDigest,
    capabilityClass: selectedCapability?.capabilityClass || null,
    capabilityClasses: selectedCapabilities.map((capability) => capability.capabilityClass),
    resolvedModelRef: selectedCapability?.resolvedModelRef || null,
    maxOutputBytes: selectedCapability?.maxOutputBytes || null,
    pluginDefault: route?.pluginDefault || 'none',
    eligiblePlugins: route?.eligiblePlugins || [],
    authorityCreated: false,
  };
  return {
    ...routeDecision,
    routeDecisionDigest: `sha256:${sha256(canonicalJson(routeDecision))}`,
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    safeSummaryOnly: true,
  };
}

export function defaultTestRegistry() {
  return {
    schemaVersion: '1.2.9',
    registryId: 'v129-fixture-registry',
    capabilities: [
      { capabilityClass: 'low_cost_worker', resolvedModelRef: 'registry:model:low', maxOutputBytes: 2048, availabilityState: 'available', authorizationState: 'authorized', costClass: 'low' },
      { capabilityClass: 'standard_code_worker', resolvedModelRef: 'registry:model:standard', maxOutputBytes: 4096, availabilityState: 'available', authorizationState: 'authorized', costClass: 'standard' },
      { capabilityClass: 'high_reasoning_planner', resolvedModelRef: 'registry:model:planner', maxOutputBytes: 8192, availabilityState: 'available', authorizationState: 'authorized', costClass: 'high' },
      { capabilityClass: 'independent_verifier', resolvedModelRef: 'registry:model:verifier', maxOutputBytes: 4096, availabilityState: 'available', authorizationState: 'authorized', costClass: 'standard' },
      { capabilityClass: 'security_specialist', resolvedModelRef: 'registry:model:security', maxOutputBytes: 4096, availabilityState: 'available', authorizationState: 'authorized', costClass: 'specialist' },
      { capabilityClass: 'runtime_specialist', resolvedModelRef: 'registry:model:runtime', maxOutputBytes: 4096, availabilityState: 'available', authorizationState: 'authorized', costClass: 'specialist' },
      { capabilityClass: 'authority_reviewer', resolvedModelRef: 'registry:model:authority', maxOutputBytes: 4096, availabilityState: 'available', authorizationState: 'authorized', costClass: 'specialist' },
    ],
    plugins: [
      { pluginId: 'codex-security', authorizedTaskClasses: ['security_scan', 'security_remediation'], requiresDefensiveScope: true, availabilityState: 'available', authorizationState: 'authorized' },
    ],
    routes: {
      routine_metadata: { requiredCapabilityClasses: ['low_cost_worker'], pluginDefault: 'none' },
      repository_discovery: { requiredCapabilityClasses: ['low_cost_worker'], pluginDefault: 'none' },
      code_change: { requiredCapabilityClasses: ['standard_code_worker', 'independent_verifier'], pluginDefault: 'none' },
      bug_repair: { requiredCapabilityClasses: ['standard_code_worker', 'independent_verifier'], pluginDefault: 'none' },
      architecture: { requiredCapabilityClasses: ['high_reasoning_planner', 'independent_verifier'], pluginDefault: 'none' },
      migration: { requiredCapabilityClasses: ['high_reasoning_planner', 'independent_verifier'], pluginDefault: 'none' },
      security_scan: { requiredCapabilityClasses: ['security_specialist', 'independent_verifier'], pluginDefault: 'none', eligiblePlugins: ['codex-security'] },
      security_remediation: { requiredCapabilityClasses: ['security_specialist', 'independent_verifier'], pluginDefault: 'none', eligiblePlugins: ['codex-security'] },
      runtime_sensitive: { requiredCapabilityClasses: ['runtime_specialist', 'independent_verifier'], pluginDefault: 'none' },
      restricted_asset: { requiredCapabilityClasses: ['runtime_specialist', 'independent_verifier'], pluginDefault: 'none' },
      authority_change: { requiredCapabilityClasses: ['authority_reviewer'], pluginDefault: 'none' },
      target_rollout: { requiredCapabilityClasses: ['standard_code_worker', 'independent_verifier'], pluginDefault: 'none' },
      research: { requiredCapabilityClasses: ['high_reasoning_planner'], pluginDefault: 'none' },
    },
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : JSON.parse(fs.readFileSync(0, 'utf8'));
  const report = routeCapability(input);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
