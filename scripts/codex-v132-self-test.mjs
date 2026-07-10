#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  canonicalJson,
  collectTrustedFinalDecision,
  collectVerifiedGithubEvidence,
  deriveCanonicalState,
  sha256,
  V132_FINAL_AUTHORITY,
  V132_VERSION,
} from './codex-v132-evidence-truth.mjs';
import {
  compileEffectivePolicy,
  loadV132Policy,
  parseJsonStrict,
  readJsonStrict,
  validateManifestProjections,
  validateStaticRegistry,
} from './codex-v132-manifest-compiler.mjs';
import {
  buildContextCacheEnvelope,
  createValidationReceipt,
  planIncrementalValidation,
  validateResumeReceipt,
} from './codex-v132-incremental-validation.mjs';
import { executeValidationPlan, V132_NODE_EXECUTOR_VERSION } from './codex-v132-node-executor.mjs';
import {
  buildDecisionCapsuleV3,
  buildOrchestrationReceipt,
  buildSafeSummary,
  evaluateLongRunBudget,
  finalizeCompactOutput,
  measureJson,
  planCiCost,
  planTargetInstallDryRun,
  validateCompatibilityDebtClosure,
  V132_OUTPUT_LIMITS,
} from './codex-v132-operational-bounds.mjs';
import { runV132SourceQualityGate } from './codex-v132-quality-gate.mjs';
import { evaluateV132CompactWorkflowReport } from './codex-workflow-quality-runner.mjs';

const ROOT = process.cwd();
const results = [];

function test(id, fn) {
  try {
    fn();
    results.push({ id, status: 'pass' });
  } catch (error) {
    results.push({ id, status: 'fail', reason: String(error.message || error).slice(0, 400) });
  }
}

function strictJson(file) {
  return readJsonStrict(path.join(ROOT, file));
}

function resolvePython() {
  const bundled = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe')
    : '';
  const candidates = [process.env.CODEX_PYTHON, 'python3', 'python', bundled].filter(Boolean);
  for (const command of candidates) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (probe.status === 0) return command;
  }
  throw new Error('python_runtime_not_available_for_parser_equivalence');
}

function validReceipts() {
  const repository = 'hiro4649/codex-development-harness';
  const headSha = 'a'.repeat(40);
  const remoteEvidence = collectVerifiedGithubEvidence({
    repository, headSha, runId: 101, runAttempt: 1,
    startedAt: '2026-07-10T00:00:00Z', completedAt: '2026-07-10T00:01:00Z', observedAt: '2026-07-10T00:01:01Z',
    conclusion: 'success',
    checkRuns: [{ checkRunId: 202, name: 'quality-gate', conclusion: 'success', headSha }],
    artifacts: [{ artifactId: 303, name: 'safe-summary', sizeInBytes: 123, contentDigest: sha256('safe-artifact') }],
  }, { testMode: true });
  const finalDecisionReceipt = collectTrustedFinalDecision({
    authority: V132_FINAL_AUTHORITY, decision: 'allow_merge', decisionId: 'decision:test:001',
    repository, headSha, observedAt: '2026-07-10T00:02:00Z',
  }, { testMode: true });
  const expected = { repository, headSha, requiredCheckSetDigest: remoteEvidence.requiredCheckSetDigest, artifactDigest: remoteEvidence.artifactDigest, testMode: true };
  return {
    expected,
    remoteEvidence,
    finalDecisionReceipt,
  };
}

function executeFixturePlan(plan) {
  return executeValidationPlan({
    plan,
    context: {
      repository: 'hiro4649/codex-development-harness',
      headSha: 'b'.repeat(40),
      workspaceIdentity: { status: 'pass', reasonCodes: [] },
      manifestProjection: { status: 'pass', reasonCodes: [], expectedProjectionDigest: sha256('projection') },
      registryObservation: { status: 'not_observed', digest: sha256('not_observed') },
      rollbackChain: { v131: 'immediate_rollback', v130: 'secondary_rollback', v129: 'emergency_legacy_rollback', v128: 'blocking_compatibility', v127: 'readable_compatibility' },
      outputLimits: { compactJsonBytes: 8192, topLevelFieldCount: 64 },
      runLocalChecks: () => ({ status: 'pass', testCount: 1 }),
      runCompatibilityChecks: () => ({ status: 'pass', reasonCodes: [] }),
      deriveCanonicalState: (completed) => deriveCanonicalState({ localValidationPassed: ['workspace_identity', 'manifest_compile', 'changed_file_classification', 'dependency_closure', 'selected_local_checks', 'compatibility_checks'].every((nodeId) => completed.get(nodeId)?.status === 'pass') }),
      runCiCostPlanning: () => ({ status: 'pass', estimatedJobs: 3, estimatedWorkflowRuns: 1 }),
    },
  });
}

test('v132_evidence_truth_local_never_remote', () => {
  const state = deriveCanonicalState({ localValidationPassed: true });
  assert.equal(state.localValidationState, 'passed');
  assert.equal(state.remoteValidationState, 'not_observed');
  assert.equal(state.technicalMergeEligibility, 'blocked');
  assert.equal(state.mergeAllowed, false);
  assert.equal(state.deprecatedLocalTechnicalReady.value, true);
  assert.equal(state.deprecatedLocalTechnicalReady.canOverrideMergeAllowed, false);
});

test('v132_evidence_truth_typed_receipts_authorize_only_exact_state', () => {
  const receipts = validReceipts();
  const state = deriveCanonicalState({ localValidationPassed: true, ...receipts });
  assert.equal(state.remoteValidationState, 'passed');
  assert.equal(state.technicalMergeEligibility, 'eligible');
  assert.equal(state.finalDecisionState, 'authorized');
  assert.equal(state.mergeAllowed, true);
  const invalid = structuredClone(receipts.remoteEvidence);
  invalid.remoteChecksPass = true;
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: invalid, expected: receipts.expected }).mergeAllowed, false);
  const plainTypedJson = structuredClone(receipts.remoteEvidence);
  const plainDecision = structuredClone(receipts.finalDecisionReceipt);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: plainTypedJson, finalDecisionReceipt: plainDecision, expected: receipts.expected }).mergeAllowed, false);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: receipts.remoteEvidence, finalDecisionReceipt: receipts.finalDecisionReceipt, expected: { ...receipts.expected, testMode: false } }).mergeAllowed, false);
});

test('v132_billing_lock_is_unavailable_not_code_failure', () => {
  const receipt = collectVerifiedGithubEvidence({
    repository: 'hiro4649/codex-development-harness', headSha: 'a'.repeat(40), runId: 1, runAttempt: 1,
    failureClass: 'account_billing_lock', annotationText: 'account billing lock',
    startedAt: '2026-07-10T00:00:00Z', completedAt: '2026-07-10T00:00:01Z', observedAt: '2026-07-10T00:00:02Z',
  }, { testMode: true });
  const state = deriveCanonicalState({ localValidationPassed: true, remoteEvidence: receipt, expected: { testMode: true } });
  assert.equal(state.remoteValidationState, 'unavailable_billing');
  assert.equal(state.remoteFailureClass, 'account_billing_lock');
  assert.equal(state.mergeAllowed, false);
});

test('v132_manifest_strict_duplicate_collision_rejection', () => {
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'), /exact_duplicate_key/);
  assert.throws(() => parseJsonStrict('{"A":1,"a":2}'), /case_fold_duplicate_key/);
  assert.throws(() => parseJsonStrict('{"a":1,"\\u0061":2}'), /escaped_equivalent_duplicate_key/);
});

test('v132_node_powershell_python_parser_equivalence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-parser-'));
  const file = path.join(dir, 'fixture.json');
  fs.writeFileSync(file, '{"schemaVersion":"1.3.2","nested":{"value":7}}\n', 'utf8');
  try {
    const nodeValue = parseJsonStrict(fs.readFileSync(file, 'utf8'));
    const escaped = file.replaceAll("'", "''");
    const powershell = spawnSync('powershell.exe', ['-NoProfile', '-Command', `$x=Get-Content -Raw '${escaped}' | ConvertFrom-Json; Write-Output ($x.schemaVersion+'|'+$x.nested.value)`], { encoding: 'utf8', windowsHide: true });
    const python = spawnSync(resolvePython(), ['-c', 'import json,sys; x=json.load(open(sys.argv[1], encoding="utf-8")); print(x["schemaVersion"]+"|"+str(x["nested"]["value"]))', file], { encoding: 'utf8', windowsHide: true });
    assert.equal(powershell.status, 0, powershell.stderr);
    assert.equal(python.status, 0, python.stderr);
    const expected = `${nodeValue.schemaVersion}|${nodeValue.nested.value}`;
    assert.equal(powershell.stdout.trim(), expected);
    assert.equal(python.stdout.trim(), expected);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('v132_manifest_projection_and_registry_inventory', () => {
  const policy = loadV132Policy(ROOT);
  const validation = validateManifestProjections({
    policy,
    sourceManifest: strictJson('CODEX_SOURCE_HARNESS_MANIFEST.json'),
    docsManifest: strictJson('docs/process/CODEX_HARNESS_MANIFEST.json'),
    activePolicy: strictJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json'),
  });
  assert.equal(validation.status, 'pass', validation.reasonCodes.join(','));
  assert.equal(validateStaticRegistry(policy.staticRegistry).classifiedRepositoryCount, 8);
  assert.equal(policy.staticRegistry.find((entry) => entry.repositoryFullName === 'hiro4649/APS-GATE').profileClass, 'lite_action_target');
  assert.equal(policy.dynamicObservationSchema.persistInStaticRegistry, false);
  assert.ok(compileEffectivePolicy(policy).compactCanonicalBytes <= 8192);
});

test('v132_incremental_validation_resume_and_invalidation', () => {
  const policy = loadV132Policy(ROOT);
  const args = { repository: 'hiro4649/codex-development-harness', profile: 'source_control_plane', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), changedFiles: ['scripts/codex-v132-self-test.mjs'], policy, registry: policy.staticRegistry, workflowInputs: { 'quality-gate.yml': sha256('workflow-a') } };
  const first = planIncrementalValidation(args);
  const execution = executeFixturePlan(first);
  assert.equal(execution.status, 'pass', execution.failureCodes.join(','));
  assert.equal(execution.executedNodeCount, 10);
  const receipt = createValidationReceipt({ plan: first, repository: args.repository, baseSha: args.baseSha, headSha: args.headSha, completedNodeResults: execution.completedNodeResults });
  const resumed = planIncrementalValidation({ ...args, previousReceipt: receipt });
  assert.ok(resumed.exactHeadNodeSkipRate >= 0.7, String(resumed.exactHeadNodeSkipRate));
  assert.equal(resumed.skippedNodeCount, 7);
  assert.equal(resumed.selectedNodeCount, 3);
  assert.equal(validateResumeReceipt(receipt, { ...args, ...first.digests, headSha: 'c'.repeat(40) }).resumeAllowed, false);
  const unknown = planIncrementalValidation({ ...args, changedFiles: ['backend/server.ts'] });
  assert.equal(unknown.status, 'full_gate_required');
  assert.equal(unknown.selectedNodeCount, 10);
  assert.throws(() => createValidationReceipt({ plan: first, repository: args.repository, baseSha: args.baseSha, headSha: args.headSha, completedNodeResults: [{ nodeId: 'workspace_identity', status: 'pass', inputDigest: first.selectedNodes[0].inputDigest }] }), /unattested_node/);

  const forged = structuredClone(receipt);
  forged.completedNodes.find((node) => node.nodeId === 'workspace_identity').output.repository = 'forged/repository';
  const forgedPlan = planIncrementalValidation({ ...args, previousReceipt: forged });
  assert.equal(forgedPlan.reusedNodes.some((node) => node.nodeId === 'workspace_identity'), false);

  const oldExecutor = structuredClone(receipt);
  oldExecutor.completedNodes.find((node) => node.nodeId === 'manifest_compile').executorVersion = `${V132_NODE_EXECUTOR_VERSION}-old`;
  const executorPlan = planIncrementalValidation({ ...args, previousReceipt: oldExecutor });
  assert.equal(executorPlan.reusedNodes.some((node) => node.nodeId === 'manifest_compile'), false);

  const workflowChanged = planIncrementalValidation({ ...args, workflowInputs: { 'quality-gate.yml': sha256('workflow-b') }, previousReceipt: receipt });
  assert.equal(workflowChanged.selectedNodes.some((node) => node.nodeId === 'ci_cost_planning'), true);

  const evidenceA = planIncrementalValidation({ ...args, evidenceReceipt: { receiptDigest: sha256('a') } });
  const evidenceB = planIncrementalValidation({ ...args, evidenceReceipt: { receiptDigest: sha256('b') } });
  assert.notEqual(evidenceA.selectedNodes.find((node) => node.nodeId === 'evidence_truth_projection').inputDigest, evidenceB.selectedNodes.find((node) => node.nodeId === 'evidence_truth_projection').inputDigest);
  assert.equal(receipt.completedNodes.every((node) => node.outputDigest === sha256(canonicalJson(node.output))), true);
});

test('v132_context_cache_envelope_limits', () => {
  const envelope = buildContextCacheEnvelope({ immutableCore: 'a'.repeat(3000), compiledRepoPolicy: 'b'.repeat(3000), taskDelta: 'c'.repeat(3000), evidenceCapsule: 'd'.repeat(3000) });
  assert.deepEqual(envelope.sections.map((entry) => entry.bytes), [1536, 1536, 2048, 2048]);
  assert.equal(envelope.totalBytes, 7168);
  assert.equal(envelope.fullManifestLoaded, false);
  assert.equal(envelope.fullConversationReplay, false);
});

test('v132_target_allowlist_rejects_nested_product_paths', () => {
  const policy = loadV132Policy(ROOT);
  const rejected = [
    'packages/web/src/index.ts', 'packages/app/apps/client.ts', 'staging/CODEX_SOURCE_HARNESS_MANIFEST.json',
    'packages/app/package.json', 'packages/app/package-lock.json', 'src/runtime/server.ts', 'contracts/Token.sol',
    'deploy/mainnet.mjs', '.env.production', 'wallet/keys.json', 'rpc/provider.json', 'secrets/token.txt',
  ];
  const plan = planTargetInstallDryRun({ profileClass: 'metadata_gate_target', changedFiles: rejected, policy });
  assert.equal(plan.status, 'fail_closed');
  assert.equal(plan.rejectedExactCount, rejected.length);
  assert.equal(plan.productFalseNegativeCount, 0);
  const allowed = planTargetInstallDryRun({ profileClass: 'metadata_gate_target', changedFiles: ['AGENTS.md', 'scripts/codex-v132-self-test.mjs'], policy });
  assert.equal(allowed.status, 'pass');
});

test('v132_ci_cost_and_debt_closure', () => {
  const ci = planCiCost({ changeClass: 'source_core' });
  assert.equal(ci.status, 'pass');
  assert.equal(ci.estimatedJobCount, 3);
  assert.equal(ci.pullRequestEditedTriggersHeavyWorkflow, false);
  assert.equal(planCiCost({ duplicateEvidenceRefresh: true }).estimatedJobCount, 0);
  const debt = validateCompatibilityDebtClosure([{ mustReviewBefore: '1.3.2', disposition: 'reclassified_with_reason', reason: 'adapter obligation retained', silentExtension: false }]);
  assert.equal(debt.status, 'pass');
  assert.equal(validateCompatibilityDebtClosure([{ mustReviewBefore: '1.3.2' }]).status, 'fail');
});

test('v132_long_run_budget_is_bounded', () => {
  assert.equal(evaluateLongRunBudget({ wallClockMinutes: 119, toolCalls: 299, fileWrites: 99, retryPerNode: 1, parallelAgentRuntime: 1 }).status, 'within_budget');
  assert.equal(evaluateLongRunBudget({ toolCalls: 301 }).status, 'checkpoint_stop');
});

test('v132_compact_output_bounds_and_canonical_fields', () => {
  const canonicalState = deriveCanonicalState({ localValidationPassed: true });
  const plan = planIncrementalValidation();
  const decision = buildDecisionCapsuleV3({ repository: 'hiro4649/codex-development-harness', headSha: 'a'.repeat(40), canonicalState, nextSafeAction: 'wait_for_remote' });
  const summary = buildSafeSummary({ repository: 'hiro4649/codex-development-harness', headSha: 'a'.repeat(40), canonicalState, nextSafeAction: 'wait_for_remote' });
  const orchestration = buildOrchestrationReceipt({ plan, repository: 'hiro4649/codex-development-harness', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40) });
  assert.ok(measureJson(decision).bytes <= V132_OUTPUT_LIMITS.decisionCapsuleBytes);
  assert.ok(measureJson(summary).bytes <= V132_OUTPUT_LIMITS.safeSummaryBytes);
  assert.ok(measureJson(orchestration).bytes <= V132_OUTPUT_LIMITS.orchestrationReceiptBytes);
  const compact = finalizeCompactOutput({ schemaVersion: V132_VERSION, repository: 'x', headSha: 'a'.repeat(40), localValidationState: 'passed', remoteValidationState: 'not_observed', technicalMergeEligibility: 'blocked', finalDecisionState: 'not_authorized', mergeAllowed: false, selectedNodeCount: 1, skippedNodeCount: 0, blockerCodes: [], nextSafeAction: 'wait' });
  assert.ok(measureJson(compact).bytes <= V132_OUTPUT_LIMITS.compactJsonBytes);
  assert.ok(measureJson(compact).topLevelFields <= 64);
  assert.equal(Object.hasOwn(compact, 'mergeReady'), false);
});

test('v132_workflow_heavy_trigger_excludes_edited', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/quality-gate.yml'), 'utf8');
  const typesLine = workflow.split(/\r?\n/).find((line) => line.includes('types:')) || '';
  assert.equal(typesLine.includes('edited'), false);
});

test('v132_workflow_runner_accepts_compact_technical_pass', () => {
  const previous = process.env.CODEX_SKIP_V132_SELF_TEST;
  process.env.CODEX_SKIP_V132_SELF_TEST = '1';
  try {
    const { report } = runV132SourceQualityGate({ repoRoot: ROOT, diagnostics: false });
    const result = evaluateV132CompactWorkflowReport(report, { gateExit: 0 });
    assert.equal(result.status, 'pass', result.failures.join(','));
    assert.equal(result.technicalRequiredCheckPassed, true);
    assert.equal(result.mergeAllowed, false);
  } finally {
    if (previous === undefined) delete process.env.CODEX_SKIP_V132_SELF_TEST;
    else process.env.CODEX_SKIP_V132_SELF_TEST = previous;
  }
});

test('v132_source_gate_end_to_end_local_only', () => {
  const previous = process.env.CODEX_SKIP_V132_SELF_TEST;
  process.env.CODEX_SKIP_V132_SELF_TEST = '1';
  try {
    const { report, exitCode } = runV132SourceQualityGate({ repoRoot: ROOT, diagnostics: false });
    assert.equal(exitCode, 0, report.blockerCodes.join(','));
    assert.equal(report.status, 'pass');
    assert.equal(report.localValidationState, 'passed');
    assert.equal(report.remoteValidationState, 'not_observed');
    assert.equal(report.technicalMergeEligibility, 'blocked');
    assert.equal(report.mergeAllowed, false);
    assert.equal(report.authorityCreated, false);
    assert.equal(report.targetMutationCount, 0);
    assert.equal(report.remoteUnobservedPassCount, 0);
    assert.ok(Buffer.byteLength(JSON.stringify(report), 'utf8') <= 8192);
  } finally {
    if (previous === undefined) delete process.env.CODEX_SKIP_V132_SELF_TEST;
    else process.env.CODEX_SKIP_V132_SELF_TEST = previous;
  }
});

const failures = results.filter((result) => result.status === 'fail');
const report = {
  schemaVersion: V132_VERSION,
  status: failures.length ? 'fail' : 'pass',
  stage: process.argv.find((arg) => arg.startsWith('--stage='))?.slice(8) || 'all',
  testCount: results.length,
  passCount: results.length - failures.length,
  failCount: failures.length,
  failures,
  authorityCreated: false,
  targetMutationCount: 0,
  PerformanceTrack: 'deferred',
  superiorityClaimState: 'not_proven',
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
