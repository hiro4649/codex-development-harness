#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  canonicalJson,
  parseJsonRejectDuplicateKeys,
  sha256,
  validateGoalContract,
} from './codex-v129-goal-contract.mjs';

const PRIORITY = [
  'authority_change',
  'restricted_asset',
  'runtime_sensitive',
  'security_remediation',
  'security_scan',
  'migration',
  'architecture',
  'target_rollout',
  'bug_repair',
  'code_change',
  'routine_metadata',
  'repository_discovery',
  'research',
];

const ROUTES = {
  routine_metadata: ['low_cost_worker'],
  repository_discovery: ['low_cost_worker'],
  code_change: ['standard_code_worker', 'independent_verifier'],
  bug_repair: ['standard_code_worker', 'independent_verifier'],
  architecture: ['high_reasoning_planner', 'independent_verifier'],
  migration: ['high_reasoning_planner', 'independent_verifier'],
  security_scan: ['security_specialist', 'independent_verifier'],
  security_remediation: ['security_specialist', 'independent_verifier'],
  runtime_sensitive: ['runtime_specialist', 'independent_verifier'],
  restricted_asset: ['runtime_specialist', 'independent_verifier'],
  authority_change: ['authority_reviewer'],
  target_rollout: ['standard_code_worker', 'independent_verifier'],
  research: ['high_reasoning_planner'],
};

function textOf(goal = {}) {
  return [
    goal.taskClass,
    goal.desiredEndState,
    ...(goal.constraints || []),
    ...(goal.nonGoals || []),
    ...(goal.evidencePlan || []),
    ...(goal.killCriteria || []),
    ...(goal.allowedFiles || []),
    ...(goal.forbiddenFiles || []),
    ...(goal.acceptanceCriteria || []).map((item) => `${item?.id || ''} ${item?.description || ''}`),
  ].join(' ').toLowerCase();
}

function pathText(goal = {}) {
  return [...(goal.allowedFiles || []), ...(goal.forbiddenFiles || []), ...(goal.truthOwnerRefs || []).map((ref) => ref.path || '')].join('\n').toLowerCase();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function candidateClasses(goal = {}) {
  const text = textOf(goal);
  const paths = pathText(goal);
  const candidates = new Set();
  if (includesAny(text + paths, ['final decision', 'authority', 'receipt', 'merge executor', 'protected ratifier', 'activeharnessversion', 'activeselftestsuite'])) candidates.add('authority_change');
  if (includesAny(text + paths, ['wallet', 'rpc', 'secret', 'deploy', 'release', 'restricted asset'])) candidates.add('restricted_asset');
  if (includesAny(text + paths, ['runtime', 'production readiness', 'mainnet', 'testnet', 'staging'])) candidates.add('runtime_sensitive');
  if (includesAny(text + paths, ['vulnerability', 'exploit', 'cve', 'attack path', 'security remediation', 'patch vulnerable'])) candidates.add('security_remediation');
  if (includesAny(text + paths, ['security scan', 'threat model', 'secret scan'])) candidates.add('security_scan');
  if (includesAny(text + paths, ['migration', 'schema migration', 'data migration'])) candidates.add('migration');
  if (includesAny(text + paths, ['architecture', 'boundary', 'design contract', 'cross-module'])) candidates.add('architecture');
  if (includesAny(text + paths, ['target rollout', 'registered target', 'portfolio rollout'])) candidates.add('target_rollout');
  if (includesAny(text + paths, ['bug', 'repair', 'fix', 'failure'])) candidates.add('bug_repair');
  if (includesAny(text + paths, ['scripts/', 'src/', '.mjs', '.js', '.ts', '.tsx'])) candidates.add('code_change');
  if (includesAny(text + paths, ['readme', 'metadata', 'manifest', 'policy index']) && !candidates.size) candidates.add('routine_metadata');
  if (includesAny(text, ['discover', 'inventory', 'list repositories'])) candidates.add('repository_discovery');
  if (includesAny(text, ['research', 'compare papers', 'external article'])) candidates.add('research');
  if (!candidates.size) candidates.add(goal.taskClass || 'routine_metadata');
  return [...candidates];
}

function chooseClass(goal = {}) {
  const candidates = candidateClasses(goal);
  return PRIORITY.find((taskClass) => candidates.includes(taskClass)) || 'routine_metadata';
}

function classifyDifficulty(goal = {}, taskClass = chooseClass(goal)) {
  const text = textOf(goal);
  const paths = pathText(goal);
  const riskFlags = [];
  if (['authority_change', 'restricted_asset', 'runtime_sensitive', 'security_remediation', 'security_scan'].includes(taskClass)) riskFlags.push('critical_boundary');
  if (includesAny(text + paths, ['wallet', 'rpc', 'deploy', 'secret'])) riskFlags.push('restricted_boundary');
  if (includesAny(text, ['cross-repo', 'portfolio', 'all registered target'])) riskFlags.push('cross_repo');
  if (includesAny(text, ['evidence contradiction', 'same blocker', 'recurring failure'])) riskFlags.push('evidence_contradiction');
  if (includesAny(text, ['migration', 'architecture', 'multiple module', 'many module'])) riskFlags.push('high_complexity');
  if (riskFlags.includes('critical_boundary') || riskFlags.includes('restricted_boundary')) return { difficulty: 'critical', riskFlags };
  if (riskFlags.length || ['migration', 'architecture'].includes(taskClass)) return { difficulty: 'high', riskFlags };
  if (['bug_repair', 'code_change', 'target_rollout'].includes(taskClass)) return { difficulty: 'medium', riskFlags };
  return { difficulty: 'low', riskFlags };
}

export function classifyGoalTask(goal = {}, options = {}) {
  const validation = validateGoalContract(goal);
  const reasonCodes = [...validation.reasonCodes];
  if (options.modelClaimedTaskClass || goal.modelClaimedTaskClass) reasonCodes.push('model_self_claim_task_class_forbidden');
  if (options.modelClaimedDifficulty || goal.modelClaimedDifficulty) reasonCodes.push('model_self_claim_difficulty_forbidden');
  const taskClass = chooseClass(goal);
  const { difficulty, riskFlags } = classifyDifficulty(goal, taskClass);
  const requiredCapabilityClasses = ROUTES[taskClass] || ['standard_code_worker'];
  const pluginEligibility = ['security_scan', 'security_remediation'].includes(taskClass) ? ['security'] : [];
  const classificationPayload = {
    goalDigest: goal.goalDigest || null,
    taskClass,
    difficulty,
    riskFlags,
    requiredCapabilityClasses,
    pluginEligibility,
  };
  return {
    schemaVersion: '1.2.9',
    candidateHarnessVersion: '1.2.9',
    taskClass,
    difficulty,
    riskFlags,
    requiredCapabilityClasses,
    pluginEligibility,
    classificationDigest: `sha256:${sha256(canonicalJson(classificationPayload))}`,
    classificationStatus: { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, safeSummaryOnly: true },
    safeSummaryOnly: true,
    status: reasonCodes.length ? 'fail' : 'pass',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let report;
  try {
    const text = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
    report = classifyGoalTask(parseJsonRejectDuplicateKeys(text));
  } catch (error) {
    report = {
      schemaVersion: '1.2.9',
      classificationStatus: { status: 'fail', reasonCodes: [String(error.message || error)], safeSummaryOnly: true },
      status: 'fail',
      safeSummaryOnly: true,
    };
  }
  writeJsonReport(report);
  exitFor(report.status);
}
