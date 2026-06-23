#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import fs from 'node:fs';
import {
  canonicalJson,
  parseJsonRejectDuplicateKeys,
  sha256,
} from './codex-v129-goal-contract.mjs';

export function digestRegistry(registry = {}) {
  return `sha256:${sha256(canonicalJson(registry))}`;
}

export function parseCapabilityRegistry(text) {
  const registry = parseJsonRejectDuplicateKeys(text);
  if (registry.schemaVersion !== '1.2.9') throw new Error('registry_schema_invalid');
  if (!Array.isArray(registry.capabilities)) throw new Error('registry_capabilities_missing');
  if (!registry.routes || typeof registry.routes !== 'object') throw new Error('registry_routes_missing');
  return registry;
}

export function loadCapabilityRegistry(env = process.env) {
  const text = env.CODEX_V129_CAPABILITY_REGISTRY_JSON;
  if (!text) return { status: 'route_unavailable', reasonCodes: ['registry_missing'] };
  let registry;
  try {
    registry = parseCapabilityRegistry(text);
  } catch (error) {
    return { status: 'fail', reasonCodes: [String(error.message || error)] };
  }
  const registryDigest = digestRegistry(registry);
  if (env.CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST && env.CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST !== registryDigest) {
    return { status: 'fail', reasonCodes: ['registry_digest_mismatch'], registryDigest };
  }
  return { status: 'pass', registry, registryDigest, reasonCodes: [] };
}

function capabilityByClass(registry, capabilityClass) {
  return (registry.capabilities || []).find((capability) => capability.capabilityClass === capabilityClass);
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
  const route = registry.routes[classification.taskClass] || {};
  const required = route.requiredCapabilityClasses || classification.requiredCapabilityClasses || [];
  const reasonCodes = [];
  let selectedCapability = null;
  for (const capabilityClass of required) {
    const capability = capabilityByClass(registry, capabilityClass);
    if (capability) {
      selectedCapability = capability;
      break;
    }
  }
  if (!selectedCapability && Array.isArray(route.fallbackChain)) {
    for (const capabilityClass of route.fallbackChain) {
      const capability = capabilityByClass(registry, capabilityClass);
      if (capability) {
        selectedCapability = capability;
        break;
      }
    }
  } else if (!selectedCapability) {
    reasonCodes.push('undeclared_fallback_forbidden');
  }
  if (!selectedCapability) reasonCodes.push('capability_unavailable');
  if (selectedCapability?.resolvedModelId) reasonCodes.push('core_model_id_forbidden');
  const routeDecision = {
    schemaVersion: '1.2.9',
    taskClass: classification.taskClass || null,
    difficulty: classification.difficulty || null,
    registryDigest,
    capabilityClass: selectedCapability?.capabilityClass || null,
    resolvedModelRef: selectedCapability?.resolvedModelRef || null,
    pluginDefault: route.pluginDefault || 'none',
    eligiblePlugins: route.eligiblePlugins || [],
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
      { capabilityClass: 'low_cost_worker', resolvedModelRef: 'registry:model:low', maxOutputBytes: 2048 },
      { capabilityClass: 'standard_code_worker', resolvedModelRef: 'registry:model:standard', maxOutputBytes: 4096 },
      { capabilityClass: 'high_reasoning_planner', resolvedModelRef: 'registry:model:planner', maxOutputBytes: 8192 },
      { capabilityClass: 'independent_verifier', resolvedModelRef: 'registry:model:verifier', maxOutputBytes: 4096 },
      { capabilityClass: 'security_specialist', resolvedModelRef: 'registry:model:security', maxOutputBytes: 4096 },
      { capabilityClass: 'runtime_specialist', resolvedModelRef: 'registry:model:runtime', maxOutputBytes: 4096 },
      { capabilityClass: 'authority_reviewer', resolvedModelRef: 'registry:model:authority', maxOutputBytes: 4096 },
    ],
    plugins: [
      { pluginId: 'codex-security', authorizedTaskClasses: ['security_scan', 'security_remediation'], requiresDefensiveScope: true },
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : JSON.parse(fs.readFileSync(0, 'utf8'));
  const report = routeCapability(input);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
