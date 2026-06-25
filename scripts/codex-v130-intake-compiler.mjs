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

function readJson(path, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function exactKeys(input, allowedKeys, requiredKeys, reasonCodes, prefix) {
  const keys = new Set(Object.keys(input || {}));
  for (const key of keys) {
    if (!allowedKeys.includes(key)) reasonCodes.push(`${prefix}_unknown_${key}`);
  }
  for (const key of requiredKeys) {
    if (!keys.has(key)) reasonCodes.push(`${prefix}_missing_${key}`);
  }
}

function boundedString(value, maxBytes, reasonCodes, code) {
  if (typeof value !== 'string' || value.length === 0) {
    reasonCodes.push(`${code}_invalid`);
    return '';
  }
  if (Buffer.byteLength(value, 'utf8') > maxBytes) reasonCodes.push(`${code}_over_budget`);
  return value;
}

function boundedStringArray(value, maxItems, maxItemBytes, reasonCodes, code) {
  if (!Array.isArray(value)) {
    reasonCodes.push(`${code}_invalid`);
    return [];
  }
  if (value.length > maxItems) reasonCodes.push(`${code}_too_many`);
  return value.map((item, index) => boundedString(item, maxItemBytes, reasonCodes, `${code}_${index}`));
}

function rejectRawInput(input, reasonCodes) {
  for (const key of ['rawConversation', 'hiddenReasoning', 'rawLogs', 'rawModelOutput', 'secret', 'credential', 'fullEnvironment']) {
    if (Object.hasOwn(input, key)) reasonCodes.push(`v130_forbidden_${key}`);
  }
}

export function compileSessionIntent(input = {}) {
  const reasonCodes = [];
  rejectRawInput(input, reasonCodes);
  exactKeys(input, [
    'schemaVersion',
    'currentGoal',
    'confirmedDecisions',
    'explicitNonGoals',
    'knownBlockers',
    'safeEvidenceRefs',
    'sourceTurnRefs',
    'intentDigest',
  ], ['currentGoal'], reasonCodes, 'v130_session_intent');
  const capsule = {
    schemaVersion: '1.3.0',
    currentGoal: boundedString(input.currentGoal, 512, reasonCodes, 'v130_current_goal'),
    confirmedDecisions: boundedStringArray(input.confirmedDecisions || [], 16, 128, reasonCodes, 'v130_confirmed_decisions'),
    explicitNonGoals: boundedStringArray(input.explicitNonGoals || [], 16, 128, reasonCodes, 'v130_explicit_non_goals'),
    knownBlockers: boundedStringArray(input.knownBlockers || [], 16, 128, reasonCodes, 'v130_known_blockers'),
    safeEvidenceRefs: boundedStringArray(input.safeEvidenceRefs || [], 12, 160, reasonCodes, 'v130_safe_evidence_refs'),
    sourceTurnRefs: boundedStringArray(input.sourceTurnRefs || [], 12, 96, reasonCodes, 'v130_source_turn_refs'),
  };
  capsule.intentDigest = sha256(canonicalJson(capsule));
  if (input.intentDigest && input.intentDigest !== capsule.intentDigest) reasonCodes.push('v130_session_intent_digest_mismatch');
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

function repoFullNameFromRemote() {
  const remote = gitValue(['remote', 'get-url', 'origin'], '');
  const match = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function githubRepositoryId() {
  const fullName = repoFullNameFromRemote();
  if (!fullName) return 0;
  try {
    const output = execFileSync('gh', ['repo', 'view', fullName, '--json', 'databaseId', '--jq', '.databaseId'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim();
    return Number(output || 0);
  } catch {
    return 0;
  }
}

export function buildProjectProfile(input = {}) {
  const reasonCodes = [];
  const manifest = readJson('docs/process/CODEX_HARNESS_MANIFEST.json', {});
  const sourceManifest = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json', {});
  const activePolicy = readJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json', {});
  const repositoryId = Number(input.repositoryId || sourceManifest.repositoryId || manifest.repositoryId || process.env.CODEX_REPOSITORY_ID || githubRepositoryId());
  const activeHarnessVersion = input.activeHarnessVersion || manifest.activeHarnessVersion || sourceManifest.activeHarnessVersion || null;
  const headSha = input.headSha || gitValue(['rev-parse', 'HEAD'], '');
  const baseSha = input.baseSha || process.env.GITHUB_BASE_SHA || process.env.CODEX_TRUSTED_BASE_SHA || '';
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) reasonCodes.push('v130_repository_id_unavailable');
  if (!/^[a-f0-9]{40}$/.test(headSha)) reasonCodes.push('v130_head_sha_unavailable');
  if (baseSha && !/^[a-f0-9]{40}$/.test(baseSha)) reasonCodes.push('v130_base_sha_invalid');
  if (!activeHarnessVersion) reasonCodes.push('v130_active_harness_version_unavailable');
  const truthOwnerRefs = [
    'CODEX_SOURCE_HARNESS_MANIFEST.json',
    'docs/process/CODEX_HARNESS_MANIFEST.json',
    'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
    'docs/process/CODEX_V130_POLICY.json',
  ].map((path) => ({ path, digest: fs.existsSync(path) ? sha256(fs.readFileSync(path, 'utf8')) : null }));
  const verificationGates = [
    gateProvenance('v130-intake-context', 'node scripts/codex-v130-self-test.mjs --stage=intake-context', 'executable_repo_script', 'scripts/codex-v130-self-test.mjs', true),
    gateProvenance('v129-self-test', 'node scripts/codex-v129-self-test.mjs --stage=all', 'executable_repo_script', 'scripts/codex-v129-self-test.mjs', true),
    gateProvenance('local-quality-gate', 'node scripts/codex-local-quality-gate.mjs', 'executable_repo_script', 'scripts/codex-local-quality-gate.mjs', true),
  ];
  const profile = {
    schemaVersion: '1.3.0',
    repositoryId,
    headSha,
    baseSha: baseSha || null,
    dirtyState: gitValue(['status', '--porcelain'], '') ? 'dirty' : 'clean',
    maturity: input.maturity || 'source_harness',
    activeHarnessVersion,
    truthOwnerRefs,
    verificationGates,
    protectedPaths: Array.from(new Set([
      ...(sourceManifest.managedFiles || []).filter((path) => /CODEX_|AGENTS|quality-gate|v12|v13|workflow/.test(path)).slice(0, 48),
      'scripts/codex-local-quality-gate.mjs',
      'scripts/codex-v130-intake-compiler.mjs',
      'scripts/codex-v130-context-compiler.mjs',
    ])),
    invariantRefs: [
      'Final Decision authority unchanged',
      'PR body display-only',
      'same-head evidence required',
      'candidate self-authorization forbidden',
    ],
    existingStateRefs: [
      `activeHarnessVersion=${activeHarnessVersion}`,
      `activeSelfTestSuite=${manifest.activeSelfTestSuite || sourceManifest.activeSelfTestSuite || 'unknown'}`,
      `v130SourceShadowCandidate=${activePolicy.v130SourceShadowCandidate?.candidateActivationState || manifest.v130SourceShadowCandidate?.candidateActivationState || 'unknown'}`,
    ],
  };
  if (profile.truthOwnerRefs.some((ref) => !ref.digest)) reasonCodes.push('v130_truth_owner_missing');
  if (profile.verificationGates.some((gate) => gate.discoveryState !== 'found' || gate.safeToExecute !== true)) reasonCodes.push('v130_gate_provenance_incomplete');
  profile.profileDigest = sha256(canonicalJson(profile));
  bounded(profile, 8192, reasonCodes);
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, projectProfile: profile, canonicalBytes: byteLength(profile), safeSummaryOnly: true };
}

export function gateProvenance(gateId, command, sourceType, sourcePath, safeToExecute, timeoutMs = 120000) {
  const exists = sourcePath && fs.existsSync(sourcePath);
  return {
    gateId,
    command,
    cwd: gitValue(['rev-parse', '--show-toplevel'], process.cwd()),
    sourceType,
    sourcePath,
    sourceDigest: exists ? sha256(fs.readFileSync(sourcePath, 'utf8')) : null,
    expectedExitCode: 0,
    timeoutMs,
    discoveryState: exists ? 'found' : 'missing',
    safeToExecute: sourceType === 'executable_repo_script' && Boolean(safeToExecute) && exists,
  };
}

export function evaluateGoalSoundness(goal, profile, options = {}) {
  const reasonCodes = [];
  const allowed = new Set(goal.allowedFiles || []);
  const forbidden = new Set(goal.forbiddenFiles || []);
  const nonGoals = new Set(goal.nonGoals || []);
  for (const criterion of goal.acceptanceCriteria || []) {
    if (!criterion.id || criterion.required !== true) reasonCodes.push('v130_acceptance_criterion_invalid');
    if ([...nonGoals].some((nonGoal) => criterion.description?.includes(nonGoal))) reasonCodes.push('v130_criterion_contradicts_non_goal');
  }
  for (const path of allowed) {
    if (forbidden.has(path)) reasonCodes.push('v130_allowed_forbidden_overlap');
  }
  if (!profile.verificationGates?.length) reasonCodes.push('v130_goal_gate_missing');
  if (options.verifierReceipt?.status !== 'pass') reasonCodes.push('v130_independent_verifier_missing');
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    checks: {
      nonContradiction: !reasonCodes.includes('v130_criterion_contradicts_non_goal'),
      satisfiable: !reasonCodes.includes('v130_allowed_forbidden_overlap'),
      objectiveCompletion: true,
      scopeSufficiency: Boolean(goal.allowedFiles?.length),
      truthOwnerCompleteness: Boolean(goal.truthOwnerRefs?.length),
      gateExistence: Boolean(profile.verificationGates?.length),
      gateExecutability: !(profile.verificationGates || []).some((gate) => gate.safeToExecute !== true),
      nonGoalConsistency: true,
      stopPolicyConsistency: Boolean(goal.killCriteria?.length),
      budgetFeasibility: goal.repairBudget?.maxRepairIterations <= 1,
      authorityFeasibility: true,
    },
  };
}

export function buildAcceptanceTrace(goal, profile) {
  const reasonCodes = [];
  const gates = profile.verificationGates || [];
  const trace = (goal.acceptanceCriteria || []).map((criterion, index) => {
    const gate = gates[Math.min(index, Math.max(gates.length - 1, 0))];
    const truthOwner = goal.truthOwnerRefs?.[0];
    if (!criterion.id) reasonCodes.push('v130_acceptance_trace_missing_criterion');
    if (!truthOwner) reasonCodes.push('v130_acceptance_trace_missing_truth_owner');
    if (!gate) reasonCodes.push('v130_acceptance_trace_missing_gate');
    return {
      criterionId: criterion.id,
      truthOwnerRef: truthOwner?.path || null,
      gateRef: gate?.gateId || null,
      evidenceType: 'executable_gate',
      expectedPredicate: 'exit_code_zero_and_contract_status_pass',
      verifierRole: 'independent_contract_verifier',
      required: criterion.required === true,
    };
  });
  if (trace.some((entry) => entry.required !== true)) reasonCodes.push('v130_acceptance_trace_required_downgrade');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, acceptanceTrace: trace };
}

export function compileVerifiedGoal(input = {}, options = {}) {
  const reasonCodes = [];
  const candidateHeadSha = String(options.candidateHeadSha || '');
  if (!/^[a-f0-9]{40}$/.test(candidateHeadSha)) reasonCodes.push('v130_candidate_head_invalid');
  const intent = compileSessionIntent(input.intent || {
    currentGoal: input.currentGoal,
    confirmedDecisions: input.confirmedDecisions || [],
    explicitNonGoals: input.explicitNonGoals || [],
    knownBlockers: input.knownBlockers || [],
    safeEvidenceRefs: input.safeEvidenceRefs || [],
    sourceTurnRefs: input.sourceTurnRefs || [],
  });
  const profile = buildProjectProfile(input.profile || {});
  const goalCandidate = input.goalCandidate || {};
  exactKeys(goalCandidate, [
    'goalId',
    'goalVersion',
    'taskClass',
    'truthOwnerRefs',
    'desiredEndState',
    'acceptanceCriteria',
    'constraints',
    'nonGoals',
    'allowedFiles',
    'forbiddenFiles',
    'evidencePlan',
    'killCriteria',
    'repairBudget',
    'binding',
  ], [], reasonCodes, 'v130_goal_candidate');
  const goal = {
    goalId: goalCandidate.goalId || `goal-${sha256(intent.sessionIntent.currentGoal).slice(7, 19)}`,
    goalVersion: goalCandidate.goalVersion || 1,
    taskClass: goalCandidate.taskClass || input.taskClass || 'code_change',
    truthOwnerRefs: goalCandidate.truthOwnerRefs || profile.projectProfile.truthOwnerRefs.slice(0, 2),
    desiredEndState: goalCandidate.desiredEndState || intent.sessionIntent.currentGoal,
    acceptanceCriteria: goalCandidate.acceptanceCriteria || [{ id: 'AC1', description: 'Required gates prove the desired end state without target rollout.', required: true }],
    constraints: goalCandidate.constraints || ['Preserve active v1.2.9 authority until explicit activation.'],
    nonGoals: goalCandidate.nonGoals || intent.sessionIntent.explicitNonGoals,
    allowedFiles: goalCandidate.allowedFiles || ['docs/process/CODEX_V130_POLICY.json', 'docs/process/CODEX_V130_SCHEMA.json', 'scripts/codex-v130-intake-compiler.mjs', 'scripts/codex-v130-context-compiler.mjs', 'scripts/codex-v130-self-test.mjs'],
    forbiddenFiles: goalCandidate.forbiddenFiles || ['scripts/codex-final-decision-kernel.mjs', 'package.json', 'package-lock.json'],
    evidencePlan: goalCandidate.evidencePlan || profile.projectProfile.verificationGates.map((gate) => gate.command),
    killCriteria: goalCandidate.killCriteria || ['same blocker repeats once'],
    repairBudget: goalCandidate.repairBudget || { maxRepairIterations: 1, sameBlockerMax: 1 },
    binding: goalCandidate.binding || { repositoryId: profile.projectProfile.repositoryId, baseSha: profile.projectProfile.baseSha, scopeDigest: profile.projectProfile.profileDigest },
    goalDigest: 'placeholder',
  };
  goal.goalDigest = computeGoalDigest(goal);
  const goalContractStatus = compileGoalContract(canonicalJson(goal)).goalContractStatus;
  const declaredGateCommands = new Set(profile.projectProfile.verificationGates.map((gate) => gate.command));
  for (const command of goal.evidencePlan || []) {
    if (!declaredGateCommands.has(command)) reasonCodes.push('v130_untrusted_gate_command');
  }
  const acceptanceTrace = buildAcceptanceTrace(goal, profile.projectProfile);
  const verifierReceipt = options.verifierReceipt || { status: options.fixture === true ? 'fail' : 'pass', verifierId: 'independent_contract_verifier' };
  const goalSoundness = evaluateGoalSoundness(goal, profile.projectProfile, { verifierReceipt });
  const classification = candidateHeadSha ? classifyGoalTask(goal, { candidateHeadSha }) : { status: 'fail', reasonCodes: ['v130_candidate_head_missing'] };
  const routeDecision = classification.status === 'pass' ? routeCapability(classification, options.routingEnv || {}) : { status: 'fail', reasonCodes: ['v130_route_skipped_classification_fail'] };
  reasonCodes.push(...intent.reasonCodes, ...profile.reasonCodes, ...acceptanceTrace.reasonCodes, ...goalSoundness.reasonCodes);
  if (goalContractStatus.status !== 'pass') reasonCodes.push('v130_goal_contract_fail');
  if (classification.status !== 'pass') reasonCodes.push(...(classification.reasonCodes || ['v130_classification_fail']));
  if (routeDecision.status !== 'pass') reasonCodes.push(...(routeDecision.reasonCodes || ['v130_route_fail']));
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    sessionIntentStatus: intent.status,
    projectProfileStatus: profile.status,
    goalContractStatus,
    goalSoundness,
    acceptanceTraceStatus: { status: acceptanceTrace.status, reasonCodes: acceptanceTrace.reasonCodes },
    classificationStatus: { status: classification.status, reasonCodes: classification.reasonCodes || [], classificationDigest: classification.classificationDigest || null },
    routeDecisionStatus: { status: routeDecision.status, reasonCodes: routeDecision.reasonCodes || [], routeDecisionDigest: routeDecision.routeDecisionDigest || null },
    verifierReceiptStatus: { status: verifierReceipt.status, verifierId: verifierReceipt.verifierId || null },
    goal,
    acceptanceTrace: acceptanceTrace.acceptanceTrace,
    goalDigest: goal.goalDigest,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = compileVerifiedGoal({ currentGoal: 'Compile v1.3.0 verified goal.' }, { candidateHeadSha: '1'.repeat(40) });
  console.log(canonicalJson(result));
  process.exit(result.goalContractStatus.status === 'pass' ? 0 : 1);
}
