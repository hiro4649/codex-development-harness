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
  if (!goal.desiredEndState || /^subjective|looks good|lgtm$/i.test(goal.desiredEndState)) reasonCodes.push('v130_objective_completion_unverifiable');
  if ((goal.acceptanceCriteria || []).some((criterion) => /subjective|looks good|lgtm|human opinion/i.test(criterion.description || ''))) reasonCodes.push('v130_subjective_completion_forbidden');
  if ((goal.nonGoals || []).some((nonGoal) => (goal.desiredEndState || '').includes(nonGoal))) reasonCodes.push('v130_desired_state_contradicts_non_goal');
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    checks: {
      nonContradiction: !reasonCodes.includes('v130_criterion_contradicts_non_goal'),
      satisfiable: !reasonCodes.includes('v130_allowed_forbidden_overlap'),
      objectiveCompletion: !reasonCodes.includes('v130_objective_completion_unverifiable') && !reasonCodes.includes('v130_subjective_completion_forbidden'),
      scopeSufficiency: Boolean(goal.allowedFiles?.length),
      truthOwnerCompleteness: Boolean(goal.truthOwnerRefs?.length),
      gateExistence: Boolean(profile.verificationGates?.length),
      gateExecutability: !(profile.verificationGates || []).some((gate) => gate.safeToExecute !== true),
      nonGoalConsistency: !reasonCodes.includes('v130_desired_state_contradicts_non_goal'),
      stopPolicyConsistency: Boolean(goal.killCriteria?.length),
      budgetFeasibility: goal.repairBudget?.maxRepairIterations <= 1,
      authorityFeasibility: true,
    },
  };
}

export function buildAcceptanceTrace(goal, profile, traceCandidate = null) {
  const reasonCodes = [];
  const gates = profile.verificationGates || [];
  if (!Array.isArray(traceCandidate)) {
    reasonCodes.push('v130_acceptance_trace_missing');
  }
  const trace = Array.isArray(traceCandidate) ? traceCandidate : [];
  const criteria = goal.acceptanceCriteria || [];
  if (trace.length !== criteria.length) reasonCodes.push('v130_acceptance_trace_count_mismatch');
  const criterionIds = criteria.map((criterion) => criterion.id);
  const gateIds = new Set(gates.map((gate) => gate.gateId));
  const truthOwnerPaths = new Set((goal.truthOwnerRefs || []).map((ref) => ref.path));
  trace.forEach((entry, index) => {
    const expectedCriterionId = criterionIds[index];
    if (entry.criterionId !== expectedCriterionId) reasonCodes.push('v130_acceptance_trace_criterion_mismatch');
    if (!truthOwnerPaths.has(entry.truthOwnerRef)) reasonCodes.push('v130_acceptance_trace_missing_truth_owner');
    if (!gateIds.has(entry.gateRef)) reasonCodes.push('v130_acceptance_trace_missing_gate');
    if (!entry.expectedPredicate || entry.expectedPredicate === 'pass') reasonCodes.push('v130_acceptance_trace_rubber_stamp');
    if (entry.verifierRole !== 'independent_contract_verifier') reasonCodes.push('v130_acceptance_trace_missing_verifier');
    if (entry.required !== true) reasonCodes.push('v130_acceptance_trace_required_downgrade');
    if (entry.evidenceType !== 'executable_gate') reasonCodes.push('v130_acceptance_trace_evidence_type_invalid');
  });
  if (trace.some((entry) => entry.required !== true)) reasonCodes.push('v130_acceptance_trace_required_downgrade');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, acceptanceTrace: trace };
}

export function validateContractVerifierReceipt(receipt = {}, context = {}) {
  const reasonCodes = [];
  const allowed = new Set([
    'schemaVersion',
    'goalCandidateDigest',
    'projectProfileDigest',
    'candidateHeadSha',
    'verifierAgentId',
    'verifierThreadDigest',
    'verifierWorktreeDigest',
    'synthesizerAgentId',
    'synthesizerThreadDigest',
    'synthesizerWorktreeDigest',
    'goalDigestRecomputed',
    'scopeDigestRecomputed',
    'gateProvenanceDigest',
    'acceptanceTraceDigest',
    'status',
    'reasonCodes',
    'authorityCreated',
    'receiptDigest',
  ]);
  for (const key of Object.keys(receipt || {})) {
    if (!allowed.has(key)) reasonCodes.push(`v130_verifier_receipt_unknown_${key}`);
  }
  if (receipt.schemaVersion !== '1.3.0') reasonCodes.push('v130_verifier_receipt_schema_invalid');
  for (const key of ['goalCandidateDigest', 'projectProfileDigest', 'goalDigestRecomputed', 'scopeDigestRecomputed', 'gateProvenanceDigest', 'acceptanceTraceDigest', 'verifierThreadDigest', 'verifierWorktreeDigest']) {
    if (!/^sha256:[a-f0-9]{64}$/.test(String(receipt[key] || ''))) reasonCodes.push(`v130_verifier_receipt_${key}_invalid`);
  }
  if (!/^[a-f0-9]{40}$/.test(String(receipt.candidateHeadSha || ''))) reasonCodes.push('v130_verifier_receipt_candidate_head_invalid');
  if (!receipt.verifierAgentId || receipt.verifierAgentId === receipt.synthesizerAgentId) reasonCodes.push('v130_verifier_agent_not_independent');
  if (receipt.verifierThreadDigest === receipt.synthesizerThreadDigest) reasonCodes.push('v130_verifier_thread_not_independent');
  if (receipt.verifierWorktreeDigest === receipt.synthesizerWorktreeDigest) reasonCodes.push('v130_verifier_worktree_not_independent');
  if (receipt.status !== 'pass') reasonCodes.push('v130_verifier_receipt_not_pass');
  if (receipt.authorityCreated !== false) reasonCodes.push('v130_verifier_authority_created');
  if (context.candidateHeadSha && receipt.candidateHeadSha !== context.candidateHeadSha) reasonCodes.push('v130_verifier_candidate_head_mismatch');
  if (context.projectProfileDigest && receipt.projectProfileDigest !== context.projectProfileDigest) reasonCodes.push('v130_verifier_project_profile_mismatch');
  const comparable = { ...receipt, receiptDigest: 'placeholder' };
  const expected = sha256(canonicalJson(comparable));
  if (receipt.receiptDigest !== expected) reasonCodes.push('v130_verifier_receipt_digest_mismatch');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, safeSummaryOnly: true };
}

export function evaluateGateAdequacy(goal = {}, trace = [], input = {}) {
  const reasonCodes = [];
  const taskClass = goal.taskClass || 'code_change';
  const required = ['code_change', 'bug_repair'].includes(taskClass);
  if (required) {
    for (const key of ['preFixFailureReproduced', 'postFixPass', 'existingPassRetained', 'changedSurfaceCovered']) {
      if (input[key] !== true) reasonCodes.push(`v130_gate_adequacy_${key}_missing`);
    }
    for (const key of ['assertionWeakening', 'skipIncrease', 'snapshotRubberStamp', 'mockOnlyCompletion', 'testDeletion', 'requiredCheckDeletion']) {
      if (Number(input[key] || 0) !== 0) reasonCodes.push(`v130_gate_adequacy_${key}_forbidden`);
    }
  }
  const mediumEvidence = ['holdoutCase', 'propertyTest', 'mutationEvidence', 'independentRegressionCase', 'existingInvariant']
    .some((key) => input[key] === true);
  if (input.difficulty === 'medium' && !mediumEvidence) reasonCodes.push('v130_gate_adequacy_medium_evidence_missing');
  if (!trace.length) reasonCodes.push('v130_gate_adequacy_trace_missing');
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    admissionState: reasonCodes.length ? 'gate_inadequate' : 'gate_adequate',
    executionMode: reasonCodes.length ? 'generate_only' : 'execute_allowed',
    safeSummaryOnly: true,
  };
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
  const goalCandidate = input.goalCandidate || null;
  if (!goalCandidate && !options.goalSynthesizerReceipt && options.fixture !== true) reasonCodes.push('v130_goal_candidate_missing');
  if (!goalCandidate && options.fixture === true) reasonCodes.push('v130_fixture_goal_activation_ineligible');
  if (!goalCandidate) {
    reasonCodes.push(...intent.reasonCodes, ...profile.reasonCodes);
    return {
      status: 'fail',
      reasonCodes,
      sessionIntentStatus: intent.status,
      projectProfileStatus: profile.status,
      goalContractStatus: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'], safeSummaryOnly: true },
      goalSoundness: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'] },
      gateAdequacyStatus: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'], admissionState: 'gate_inadequate', executionMode: 'generate_only' },
      acceptanceTraceStatus: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'] },
      classificationStatus: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'], classificationDigest: null },
      routeDecisionStatus: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'], routeDecisionDigest: null },
      verifierReceiptStatus: { status: 'fail', reasonCodes: ['v130_goal_candidate_missing'] },
      goal: null,
      acceptanceTrace: [],
      goalDigest: null,
      safeSummaryOnly: true,
    };
  }
  const normalizedGoalCandidate = goalCandidate || {};
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
    goalId: normalizedGoalCandidate.goalId,
    goalVersion: normalizedGoalCandidate.goalVersion,
    taskClass: normalizedGoalCandidate.taskClass,
    truthOwnerRefs: normalizedGoalCandidate.truthOwnerRefs,
    desiredEndState: normalizedGoalCandidate.desiredEndState,
    acceptanceCriteria: normalizedGoalCandidate.acceptanceCriteria,
    constraints: normalizedGoalCandidate.constraints,
    nonGoals: normalizedGoalCandidate.nonGoals,
    allowedFiles: normalizedGoalCandidate.allowedFiles,
    forbiddenFiles: normalizedGoalCandidate.forbiddenFiles,
    evidencePlan: normalizedGoalCandidate.evidencePlan,
    killCriteria: normalizedGoalCandidate.killCriteria,
    repairBudget: normalizedGoalCandidate.repairBudget,
    binding: normalizedGoalCandidate.binding,
    goalDigest: 'placeholder',
  };
  goal.goalDigest = computeGoalDigest(goal);
  const goalContractStatus = compileGoalContract(canonicalJson(goal)).goalContractStatus;
  const declaredGateCommands = new Set(profile.projectProfile.verificationGates.map((gate) => gate.command));
  for (const command of goal.evidencePlan || []) {
    if (!declaredGateCommands.has(command)) reasonCodes.push('v130_untrusted_gate_command');
  }
  const acceptanceTrace = buildAcceptanceTrace(goal, profile.projectProfile, input.acceptanceTraceCandidate);
  const verifierValidation = options.verifierReceipt
    ? validateContractVerifierReceipt(options.verifierReceipt, { candidateHeadSha, projectProfileDigest: profile.projectProfile.profileDigest })
    : { status: 'fail', reasonCodes: ['v130_verifier_receipt_missing'] };
  const goalSoundness = evaluateGoalSoundness(goal, profile.projectProfile, { verifierReceipt: verifierValidation });
  const gateAdequacy = evaluateGateAdequacy(goal, acceptanceTrace.acceptanceTrace, input.gateAdequacyEvidence || {});
  const classification = candidateHeadSha ? classifyGoalTask(goal, { candidateHeadSha }) : { status: 'fail', reasonCodes: ['v130_candidate_head_missing'] };
  const routeDecision = classification.status === 'pass' ? routeCapability(classification, options.routingEnv || {}) : { status: 'fail', reasonCodes: ['v130_route_skipped_classification_fail'] };
  reasonCodes.push(...intent.reasonCodes, ...profile.reasonCodes, ...acceptanceTrace.reasonCodes, ...goalSoundness.reasonCodes, ...verifierValidation.reasonCodes, ...gateAdequacy.reasonCodes);
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
    gateAdequacyStatus: { status: gateAdequacy.status, reasonCodes: gateAdequacy.reasonCodes, admissionState: gateAdequacy.admissionState, executionMode: gateAdequacy.executionMode },
    acceptanceTraceStatus: { status: acceptanceTrace.status, reasonCodes: acceptanceTrace.reasonCodes },
    classificationStatus: { status: classification.status, reasonCodes: classification.reasonCodes || [], classificationDigest: classification.classificationDigest || null },
    routeDecisionStatus: { status: routeDecision.status, reasonCodes: routeDecision.reasonCodes || [], routeDecisionDigest: routeDecision.routeDecisionDigest || null },
    verifierReceiptStatus: { status: verifierValidation.status, reasonCodes: verifierValidation.reasonCodes },
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
