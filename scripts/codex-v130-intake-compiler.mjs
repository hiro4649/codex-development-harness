#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonicalJson, compileGoalContract, computeGoalDigest } from './codex-v129-goal-contract.mjs';
import { classifyGoalTask } from './codex-v129-task-classifier.mjs';
import { routeCapability } from './codex-v129-capability-router.mjs';

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function byteLength(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
}

function bounded(value, maxBytes, reasonCodes) {
  if (byteLength(value) > maxBytes) reasonCodes.push('v130_intake_budget_exceeded');
}

function rejectRawInput(input, reasonCodes) {
  for (const key of ['rawConversation', 'hiddenReasoning', 'rawLogs', 'rawModelOutput', 'secret']) {
    if (Object.hasOwn(input, key)) reasonCodes.push(`v130_forbidden_${key}`);
  }
}

export function compileSessionIntent(input = {}) {
  const reasonCodes = [];
  rejectRawInput(input, reasonCodes);
  const capsule = {
    schemaVersion: '1.3.0',
    currentGoal: String(input.currentGoal || '').slice(0, 512),
    confirmedDecisions: Array.isArray(input.confirmedDecisions) ? input.confirmedDecisions.slice(0, 16) : [],
    explicitNonGoals: Array.isArray(input.explicitNonGoals) ? input.explicitNonGoals.slice(0, 16) : [],
    knownBlockers: Array.isArray(input.knownBlockers) ? input.knownBlockers.slice(0, 16) : [],
    safeEvidenceRefs: Array.isArray(input.safeEvidenceRefs) ? input.safeEvidenceRefs.slice(0, 12) : [],
    sourceTurnRefs: Array.isArray(input.sourceTurnRefs) ? input.sourceTurnRefs.slice(0, 12) : [],
  };
  capsule.intentDigest = sha256(canonicalJson(capsule));
  bounded(capsule, 1536, reasonCodes);
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, sessionIntent: capsule, canonicalBytes: byteLength(capsule), safeSummaryOnly: true };
}

function gitValue(args, fallback) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

export function buildProjectProfile(input = {}) {
  const reasonCodes = [];
  const profile = {
    schemaVersion: '1.3.0',
    repositoryId: Number(input.repositoryId || 1243452288),
    headSha: input.headSha || gitValue(['rev-parse', 'HEAD'], '0'.repeat(40)),
    baseSha: input.baseSha || gitValue(['rev-parse', 'HEAD~1'], '0'.repeat(40)),
    dirtyState: gitValue(['status', '--porcelain'], '') ? 'dirty' : 'clean',
    maturity: input.maturity || 'source_harness',
    activeHarnessVersion: input.activeHarnessVersion || '1.2.9',
    truthOwnerRefs: Array.isArray(input.truthOwnerRefs) ? input.truthOwnerRefs.slice(0, 16) : ['CODEX_SOURCE_HARNESS_MANIFEST.json'],
    verificationGates: Array.isArray(input.verificationGates) ? input.verificationGates.slice(0, 16) : ['node scripts/codex-v130-self-test.mjs --stage=all'],
    protectedPaths: Array.isArray(input.protectedPaths) ? input.protectedPaths.slice(0, 32) : ['scripts/codex-local-quality-gate.mjs'],
    invariantRefs: Array.isArray(input.invariantRefs) ? input.invariantRefs.slice(0, 32) : ['Final Decision authority unchanged'],
    existingStateRefs: Array.isArray(input.existingStateRefs) ? input.existingStateRefs.slice(0, 32) : ['activeHarnessVersion=1.2.9'],
  };
  profile.profileDigest = sha256(canonicalJson(profile));
  bounded(profile, 8192, reasonCodes);
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, projectProfile: profile, canonicalBytes: byteLength(profile), safeSummaryOnly: true };
}

export function compileVerifiedGoal(input = {}, options = {}) {
  const reasonCodes = [];
  const candidateHeadSha = String(options.candidateHeadSha || '');
  if (!/^[a-f0-9]{40}$/.test(candidateHeadSha)) reasonCodes.push('v130_candidate_head_invalid');
  const intent = compileSessionIntent(input.intent || input);
  const profile = buildProjectProfile(input.profile || {});
  const goal = {
    goalId: input.goalId || 'goal-v130-intake',
    goalVersion: 1,
    taskClass: input.taskClass || 'code_change',
    truthOwnerRefs: [{ path: 'docs/process/CODEX_V130_POLICY.json', digest: sha256(fs.readFileSync('docs/process/CODEX_V130_POLICY.json', 'utf8')) }],
    desiredEndState: input.desiredEndState || intent.sessionIntent.currentGoal || 'Compile verified v1.3.0 goal.',
    acceptanceCriteria: [{ id: 'AC1', description: 'Verified goal compiles through v129 Goal Contract.', required: true }],
    constraints: ['Preserve v1.2.9 active authority.'],
    nonGoals: ['No target rollout.'],
    allowedFiles: ['docs/process/CODEX_V130_POLICY.json', 'scripts/codex-v130-intake-compiler.mjs'],
    forbiddenFiles: ['scripts/codex-final-decision-kernel.mjs'],
    evidencePlan: ['node scripts/codex-v130-self-test.mjs --stage=intake-context'],
    killCriteria: ['same blocker repeats once'],
    repairBudget: { maxRepairIterations: 1, sameBlockerMax: 1 },
    binding: { repositoryId: profile.projectProfile.repositoryId, baseSha: profile.projectProfile.baseSha, scopeDigest: profile.projectProfile.profileDigest },
    goalDigest: 'placeholder',
  };
  goal.goalDigest = computeGoalDigest(goal);
  const goalContractStatus = compileGoalContract(canonicalJson(goal)).goalContractStatus;
  const classification = candidateHeadSha ? classifyGoalTask(goal, { candidateHeadSha }) : { status: 'fail', reasonCodes: ['v130_candidate_head_missing'] };
  const routeDecision = classification.status === 'pass' ? routeCapability(classification, options.routingEnv || {}) : { status: 'fail', reasonCodes: ['v130_route_skipped_classification_fail'] };
  reasonCodes.push(...intent.reasonCodes, ...profile.reasonCodes);
  if (goalContractStatus.status !== 'pass') reasonCodes.push('v130_goal_contract_fail');
  if (classification.status !== 'pass') reasonCodes.push(...(classification.reasonCodes || ['v130_classification_fail']));
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    sessionIntentStatus: intent.status,
    projectProfileStatus: profile.status,
    goalContractStatus,
    classificationStatus: { status: classification.status, reasonCodes: classification.reasonCodes || [], classificationDigest: classification.classificationDigest || null },
    routeDecisionStatus: { status: routeDecision.status, reasonCodes: routeDecision.reasonCodes || [], routeDecisionDigest: routeDecision.routeDecisionDigest || null },
    goal,
    goalDigest: goal.goalDigest,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = compileVerifiedGoal({ currentGoal: 'Compile v1.3.0 verified goal.' }, { candidateHeadSha: '1'.repeat(40) });
  console.log(canonicalJson(result));
  process.exit(result.goalContractStatus.status === 'pass' ? 0 : 1);
}
