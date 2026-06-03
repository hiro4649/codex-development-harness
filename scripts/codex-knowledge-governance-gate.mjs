#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, readJson, readText, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const defaultMapPath = 'docs/process/CODEX_KNOWLEDGE_MAP.json';
const requiredPolicies = [
  'docs/process/CODEX_PROMPT_GOVERNANCE_POLICY.md',
  'docs/process/CODEX_KNOWLEDGE_GOVERNANCE_POLICY.md',
  'docs/process/CODEX_CONTRACT_GOVERNANCE_POLICY.md',
  'docs/process/CODEX_CODE_REVIEW_MONITOR_POLICY.md',
];
const requiredSkills = ['.agents/skills/codex-bugfix/SKILL.md'];
const requiredEvals = ['docs/process/CODEX_PROMPT_EVAL_SUITE.json', 'docs/process/CODEX_REVIEW_EVAL_CASES.json'];
const requiredContracts = ['docs/process/CODEX_TASK_CONTRACT_SCHEMA.json', 'docs/process/CODEX_HANDOFF_SCHEMA.json', 'docs/process/CODEX_LOAD_BEARING_EVIDENCE_SCHEMA.json'];

function flattenIndex(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value).flat();
  return [];
}

function hasEntry(entries, file) {
  return entries.some((entry) => String(entry) === file || String(entry).endsWith(file));
}

function agentsTooManualLike(env = process.env) {
  if (env.CODEX_KNOWLEDGE_TEST_AGENTS_LONG === '1') return true;
  const text = readText('AGENTS.md') || '';
  const lineCount = text.split(/\r?\n/).length;
  const detailHits = (text.match(/Step \d+|Phase \d+|implementation detail|runtime P1|product fix/gi) || []).length;
  return lineCount > 140 || detailHits > 5;
}

export function buildKnowledgeGovernanceReport(env = process.env) {
  const mode = env.CODEX_KNOWLEDGE_GOVERNANCE_MODE || (env.CODEX_EVENT_NAME === 'pull_request' ? 'enforce' : 'report');
  const mapPath = env.CODEX_KNOWLEDGE_MAP_PATH || defaultMapPath;
  const parsed = readJson(mapPath);
  const reasonCodes = [];
  if (!parsed.ok) reasonCodes.push('knowledge_map_missing');
  const map = parsed.ok ? parsed.value : {};
  if (parsed.ok && (!map || typeof map !== 'object' || map.safeSummaryOnly !== true)) reasonCodes.push('knowledge_map_invalid');
  if (map.harnessVersion && map.harnessVersion !== HARNESS_VERSION) reasonCodes.push('knowledge_marker_mismatch');
  if (map.marker && map.marker !== marker) reasonCodes.push('knowledge_marker_mismatch');
  const sources = flattenIndex(map.sourceOfRecord);
  const policies = flattenIndex(map.policyIndex);
  const skills = flattenIndex(map.skillIndex);
  const evals = flattenIndex(map.evalIndex);
  const contracts = flattenIndex(map.contractIndex);
  const listed = [...new Set([...flattenIndex(map.entrypoints), ...sources, ...policies, ...skills, ...evals, ...contracts, ...flattenIndex(map.gateIndex), ...flattenIndex(map.reviewIndex)])];
  const missingSources = listed.filter((file) => !fs.existsSync(file));
  if (missingSources.length) reasonCodes.push('knowledge_source_missing');
  for (const file of requiredPolicies) if (!hasEntry(policies, file)) reasonCodes.push('knowledge_required_policy_not_indexed');
  for (const file of requiredSkills) if (!hasEntry(skills, file)) reasonCodes.push('knowledge_required_skill_not_indexed');
  for (const file of requiredEvals) if (!hasEntry(evals, file)) reasonCodes.push('knowledge_required_eval_not_indexed');
  for (const file of requiredContracts) if (!hasEntry(contracts, file)) reasonCodes.push('knowledge_required_contract_not_indexed');
  if (agentsTooManualLike(env)) reasonCodes.push('agents_context_too_manual_like');
  const deprecatedRefs = listed.filter((file) => /v0\.8\.[0-6]/.test(String(file)));
  if (deprecatedRefs.length) reasonCodes.push('knowledge_deprecated_version_reference');

  const blocking = reasonCodes.filter((code) => !['knowledge_orphan_policy_detected', 'knowledge_deprecated_version_reference'].includes(code));
  let status = blocking.length ? 'fail' : (reasonCodes.length ? 'warning' : 'pass');
  const payload = {
    status,
    mode,
    knowledgeMapStatus: parsed.ok ? 'pass' : 'fail',
    agentsMapStatus: agentsTooManualLike(env) ? 'fail' : 'pass',
    sourceOfRecordStatus: missingSources.length ? 'fail' : 'pass',
    orphanPolicyStatus: 'not_applicable',
    versionReferenceStatus: deprecatedRefs.length ? 'warning' : 'pass',
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
  if (scanObjectForUnsafe(payload).length || env.CODEX_KNOWLEDGE_TEST_UNSAFE === '1') {
    return simpleStatus('knowledgeGovernanceStatus', 'fail', { ...payload, reasonCodes: ['knowledge_governance_failed'] });
  }
  return simpleStatus('knowledgeGovernanceStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildKnowledgeGovernanceReport();
    writeJsonReport(report, 'CODEX_KNOWLEDGE_GOVERNANCE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('knowledgeGovernanceStatus', 'fail', { reasonCodes: ['knowledge_governance_failed'] });
    writeJsonReport(report, 'CODEX_KNOWLEDGE_GOVERNANCE_REPORT');
    process.exit(1);
  }
}
