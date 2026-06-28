#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.1

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  V131_BACKLOG_ORDER,
  V131_SELF_TEST_STATUS_KEY,
  V131_SELF_TEST_SUITE,
  V131_VERSION,
  buildCompatibilityDebtLedger,
  buildDecisionCapsuleV2,
  classifyValidationState,
  dryRunTargetProfileInstall,
  evaluateProductValueReturnGate,
  evaluateRemoteCiCostGate,
  evaluateWorkspaceIdentity,
  lintTargetProfileDrift,
  readJsonStrict,
  rejectDuplicateKeys,
  validateManifestStrict,
} from './codex-v131-operational-convergence.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch (error) {
    return { name, status: 'fail', reason: error?.message || String(error), safeSummaryOnly: true };
  }
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function contractTests() {
  const source = readJsonStrict('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const docsManifest = readJsonStrict('docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicy = readJsonStrict('docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const policy = readJsonStrict('docs/process/CODEX_V131_POLICY.json');
  const spec = readText('docs/process/CODEX_V131_SPEC.md');
  const agents = readText('AGENTS.md');
  const versionRegistry = readText('scripts/codex-harness-version.mjs');
  const operationalModule = readText('scripts/codex-v131-operational-convergence.mjs');
  const orchestrationCapsule = readText('scripts/codex-orchestration-capsule.mjs');
  const workspaceIdentity = evaluateWorkspaceIdentity();
  const worktreeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v131-worktree-'));
  fs.mkdirSync(path.join(worktreeRoot, 'admin', 'worktrees', 'current'), { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'docs', 'process'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRoot, '.git'), `gitdir: ${path.join(worktreeRoot, 'admin', 'worktrees', 'current')}\n`);
  fs.writeFileSync(path.join(worktreeRoot, 'admin', 'worktrees', 'current', 'commondir'), '../..\n');
  fs.writeFileSync(path.join(worktreeRoot, 'admin', 'config'), '[remote "origin"]\n\turl = https://github.com/hiro4649/codex-development-harness.git\n');
  fs.writeFileSync(path.join(worktreeRoot, 'AGENTS.md'), `CODEX_QUALITY_HARNESS_FILE v${V131_VERSION}\n`);
  fs.writeFileSync(path.join(worktreeRoot, 'CODEX_SOURCE_HARNESS_MANIFEST.json'), JSON.stringify({
    activeHarnessVersion: V131_VERSION,
    activeSelfTestSuite: V131_SELF_TEST_SUITE,
  }));
  fs.writeFileSync(path.join(worktreeRoot, 'docs', 'process', 'CODEX_HARNESS_MANIFEST.json'), JSON.stringify({
    activeHarnessVersion: V131_VERSION,
    activeSelfTestSuite: V131_SELF_TEST_SUITE,
  }));
  const worktreeIdentity = evaluateWorkspaceIdentity({ repoRoot: worktreeRoot });
  const misleadingRemoteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v131-misleading-remote-'));
  fs.mkdirSync(path.join(misleadingRemoteRoot, '.git'), { recursive: true });
  fs.mkdirSync(path.join(misleadingRemoteRoot, 'docs', 'process'), { recursive: true });
  fs.writeFileSync(path.join(misleadingRemoteRoot, '.git', 'config'), '[remote "origin"]\n\turl = https://github.com/hiro4649/codex-development-harness-backup.git\n');
  fs.writeFileSync(path.join(misleadingRemoteRoot, 'AGENTS.md'), `CODEX_QUALITY_HARNESS_FILE v${V131_VERSION}\n`);
  fs.writeFileSync(path.join(misleadingRemoteRoot, 'CODEX_SOURCE_HARNESS_MANIFEST.json'), JSON.stringify({
    activeHarnessVersion: V131_VERSION,
    activeSelfTestSuite: V131_SELF_TEST_SUITE,
  }));
  fs.writeFileSync(path.join(misleadingRemoteRoot, 'docs', 'process', 'CODEX_HARNESS_MANIFEST.json'), JSON.stringify({
    activeHarnessVersion: V131_VERSION,
    activeSelfTestSuite: V131_SELF_TEST_SUITE,
  }));
  const misleadingRemoteIdentity = evaluateWorkspaceIdentity({ repoRoot: misleadingRemoteRoot });
  const manifestStrict = validateManifestStrict({ sourceManifest: source, docsManifest, activePolicy });
  const validationState = classifyValidationState({ localChecksPass: true, remoteCiAllowed: false });
  const drift = lintTargetProfileDrift({
    registeredTargets: source.registeredTargetRepositories || [],
    targetProfileStrategy: source.targetProfileStrategy || {},
  });
  const metadataDrift = lintTargetProfileDrift({
    registeredTargets: [{ repositoryFullName: 'hiro4649/disco-funky-repair' }],
    targetProfileStrategy: { profileClassification: { product_heavy_target: ['hiro4649/disco-funky-repair'] } },
  });
  const costGate = evaluateRemoteCiCostGate({
    remoteCiAllowed: false,
    action: 'pull_request_create',
    estimatedRuns: 1,
  });
  const costGateBad = evaluateRemoteCiCostGate({
    remoteCiAllowed: false,
    workflowDispatch: true,
    rerun: true,
  });
  const costGateMergeBad = evaluateRemoteCiCostGate({
    remoteCiAllowed: false,
    action: 'merge',
  });
  const decisionCapsule = buildDecisionCapsuleV2({
    changedFiles: Array.from({ length: 30 }, (_, index) => `file-${index}.txt`),
    blockers: Array.from({ length: 8 }, (_, index) => `blocker-${index}`),
  });
  const debtLedger = buildCompatibilityDebtLedger();
  const badDebtLedger = buildCompatibilityDebtLedger({
    debts: [{ state: 'pass_with_compatibility_debt', reason: 'x', introducedIn: '1.3.0', affectsAuthority: false, blocking: false }],
  });
  const dryRun = dryRunTargetProfileInstall({
    repositoryFullName: 'hiro4649/disco-funky-repair',
    profile: 'metadata_gate_target',
    changedFiles: ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json'],
  });
  const dryRunBad = dryRunTargetProfileInstall({
    repositoryFullName: 'hiro4649/CRIPTO-TIP',
    profile: 'product_heavy_target',
    changedFiles: ['web/package.json', 'runtime/runner.js', 'contracts/Token.sol', '.env.production', 'src/index.js'],
    sourceManifestCopied: true,
  });
  const dryRunSourceManifestPathBad = dryRunTargetProfileInstall({
    repositoryFullName: 'hiro4649/disco-funky-repair',
    profile: 'metadata_gate_target',
    changedFiles: ['CODEX_SOURCE_HARNESS_MANIFEST.json'],
  });
  const productValue = evaluateProductValueReturnGate({ consecutiveHarnessOrDocsPrs: 3 });
  return [
    test('v131_core_active_tuple', () => source.activeHarnessVersion === V131_VERSION
      && source.activeSelfTestSuite === V131_SELF_TEST_SUITE
      && source.activeSelfTestStatusKey === V131_SELF_TEST_STATUS_KEY
      && source.currentVersion === V131_VERSION
      && source.previousVersion === '1.3.0'
      && source.candidateHarnessVersion === V131_VERSION
      && source.candidateSelfTestSuite === V131_SELF_TEST_SUITE
      && source.candidateActivationState === 'active'
      && source.sourceActivation === 'active'),
    test('v131_final_authority_unchanged', () => source.finalAuthority === 'v1.1.8_final_decision_kernel'
      && source.authorityCreated === false
      && docsManifest.authorityCreated === false
      && activePolicy.authorityCreated === false),
    test('v131_no_performance_track_or_superiority', () => source.performanceTrack?.state === 'deferred'
      && source.performanceTrack?.superiorityClaimState === 'not_proven'
      && source.v131OperationalConvergenceCore?.performanceTrackStarted === false
      && source.v131OperationalConvergenceCore?.fableComparisonStarted === false
      && source.v131OperationalConvergenceCore?.sdkBenchmarkStarted === false),
    test('v131_version_authority_chain', () => source.versionAuthority?.v131 === 'blocking_current_active_authority'
      && source.versionAuthority?.v130 === 'immediate_rollback'
      && source.versionAuthority?.v129 === 'immediate_rollback'
      && source.versionAuthority?.v128 === 'blocking_compatibility'
      && source.versionAuthority?.v127 === 'compatibility_readable'),
    test('v131_backlog_order_locked', () => JSON.stringify(policy.backlogOrder) === JSON.stringify(V131_BACKLOG_ORDER)
      && JSON.stringify(source.v131OperationalConvergenceCore?.backlogOrder) === JSON.stringify(V131_BACKLOG_ORDER)),
    test('v131_workspace_identity_gate_pass', () => workspaceIdentity.status === 'pass' && workspaceIdentity.createsAuthority === false),
    test('v131_workspace_identity_supports_git_worktree_file', () => worktreeIdentity.status === 'pass'
      && worktreeIdentity.reasonCodes.length === 0),
    test('v131_workspace_identity_uses_exact_remote_slug', () => misleadingRemoteIdentity.status === 'fail'
      && misleadingRemoteIdentity.observedRemoteRepositories.includes('hiro4649/codex-development-harness-backup')
      && misleadingRemoteIdentity.reasonCodes.includes('workspace_identity_remote_mismatch')),
    test('v131_manifest_strict_validator_pass', () => manifestStrict.status === 'pass' && manifestStrict.createsAuthority === false),
    test('v131_duplicate_key_detector_fails_closed', () => {
      try {
        rejectDuplicateKeys('{"a":1,"a":2}');
        return false;
      } catch (error) {
        return String(error.message || error).includes('duplicate_key:a');
      }
    }),
    test('v131_validation_state_machine_before_ci_cost_gate', () => policy.backlogOrder.indexOf('validation_state_machine') < policy.backlogOrder.indexOf('remote_ci_cost_gate')
      && validationState.localReadiness === 'ready'
      && validationState.remoteValidation === 'blocked_ci_quota'
      && validationState.mergeReadiness === 'merge_blocked'
      && validationState.localPassPromotedToRemotePass === false),
    test('v131_target_profile_drift_linter_pass', () => drift.status === 'pass'),
    test('v131_target_profile_drift_linter_checks_metadata_targets', () => metadataDrift.status === 'fail'
      && metadataDrift.reasonCodes.includes('target_profile_drift:hiro4649/disco-funky-repair:metadata_gate_target')),
    test('v131_remote_ci_cost_gate_allows_push_pr_blocks_rerun', () => costGate.status === 'pass'
      && costGate.pushAllowed === true
      && costGate.prCreationAllowed === true
      && costGate.workflowDispatchAllowed === false
      && costGate.rerunAllowed === false
      && costGate.remoteValidation === 'blocked_ci_quota'
      && costGate.mergeReadiness === 'merge_blocked'
      && costGate.remoteRequiredChecksPassed === false
      && costGate.mergeAllowed === false
      && costGate.mergeActionAllowed === false
      && costGate.requiredCheckBypassAllowed === false
      && costGate.localPassPromotedToRemotePass === false
      && costGateBad.status === 'fail'),
    test('v131_remote_ci_cost_gate_blocks_merge_action_when_ci_blocked', () => costGateMergeBad.status === 'fail'
      && costGateMergeBad.reasonCodes.includes('merge_forbidden_when_remote_ci_blocked')
      && costGateMergeBad.mergeReadiness === 'merge_blocked'
      && costGateMergeBad.remoteRequiredChecksPassed === false
      && costGateMergeBad.mergeAllowed === false
      && costGateMergeBad.mergeActionAllowed === false
      && costGateMergeBad.requiredCheckBypassAllowed === false),
    test('v131_decision_capsule_v2_bounded_display', () => decisionCapsule.capsuleVersion === 'v2'
      && decisionCapsule.changedFiles.length === 20
      && decisionCapsule.blockers.length === 5
      && decisionCapsule.maxDisplayLines === 50
      && decisionCapsule.remoteRequiredChecksPassed === false
      && decisionCapsule.mergeAllowed === false
      && decisionCapsule.requiredCheckBypassAllowed === false
      && decisionCapsule.localPassPromotedToRemotePass === false
      && decisionCapsule.createsAuthority === false),
    test('v131_compatibility_debt_requires_review_deadline', () => debtLedger.status === 'pass'
      && debtLedger.debts.every((debt) => debt.mustReviewBefore)
      && badDebtLedger.status === 'fail'
      && badDebtLedger.reasonCodes.includes('debt_0_mustReviewBefore_missing')),
    test('v131_target_profile_installer_is_dry_run_only', () => dryRun.status === 'pass'
      && dryRun.mode === 'dry_run_only'
      && dryRun.automaticMutationAllowed === false
      && dryRun.sensitiveDiffCount === 0
      && dryRunBad.status === 'fail'
      && dryRunBad.sensitiveDiffCount === 5
      && dryRunBad.productMutationCount === 3
      && dryRunBad.reasonCodes.includes('source_manifest_copy_forbidden')
      && dryRunBad.reasonCodes.includes('sensitive_diff_forbidden:web/package.json')
      && dryRunBad.reasonCodes.includes('sensitive_diff_forbidden:runtime/runner.js')
      && dryRunBad.reasonCodes.includes('sensitive_diff_forbidden:contracts/Token.sol')
      && dryRunBad.reasonCodes.includes('sensitive_diff_forbidden:.env.production')
      && dryRunSourceManifestPathBad.status === 'fail'
      && dryRunSourceManifestPathBad.sourceManifestCopied === true
      && dryRunSourceManifestPathBad.reasonCodes.includes('source_manifest_copy_forbidden')),
    test('v131_product_value_return_gate_advisory_nonblocking', () => productValue.status === 'pass'
      && productValue.state === 'advisory'
      && productValue.blocking === false),
    test('v131_policy_no_new_capability_tracks', () => policy.nonGoals.includes('Performance Track')
      && policy.nonGoals.includes('Fable comparison')
      && policy.nonGoals.includes('SDK benchmark')
      && policy.nonGoals.includes('Skill runtime')
      && policy.nonGoals.includes('DAG runtime')
      && policy.nonGoals.includes('automatic target mutation')),
    test('v131_operator_surface_declared', () => agents.includes('Active Source: v1.3.1 Operational Convergence Core')
      && spec.includes('HARNESS v1.3.1 Operational Convergence Core')),
    test('v131_version_registry_updated', () => versionRegistry.includes("currentVersion = '1.3.1'")
      && versionRegistry.includes("previousVersion = '1.3.0'")
      && versionRegistry.includes("'1.3.1'")),
    test('v131_no_bom_in_load_bearing_files', () => [
      'scripts/codex-local-quality-gate.mjs',
      'scripts/codex-orchestration-capsule.mjs',
      '.github/workflows/quality-gate.yml',
      '.github/workflows/weekly-health-check.yml',
    ].every((file) => {
      const bytes = fs.readFileSync(file);
      return !(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf);
    })),
    test('v131_workspace_marker_allowlist_preserves_v130_and_v131', () => orchestrationCapsule.includes("'CODEX_QUALITY_HARNESS_FILE v1.3.0'")
      && orchestrationCapsule.includes("'CODEX_QUALITY_HARNESS_FILE v1.3.1'")
      && !orchestrationCapsule.includes("'CODEX_QUALITY_HARNESS_FILE v1.3.1', 'CODEX_QUALITY_HARNESS_FILE v1.3.1'")),
    test('v131_source_body_profile_no_hot_v130_spec', () => {
      const sourceBody = activePolicy.profiles?.harness_source_body || {};
      return Array.isArray(sourceBody.requiredReads)
        && sourceBody.requiredReads.includes('compiled_instruction_envelope')
        && sourceBody.requiredReads.includes('docs/process/CODEX_V131_POLICY.json')
        && !sourceBody.requiredReads.includes('docs/process/CODEX_V130_SPEC.md')
        && sourceBody.compatibilityReferenceReads?.v130 === 'immediate_rollback_reference_only';
    }),
    test('v131_operational_module_no_remote_or_target_mutation', () => !operationalModule.includes('child_process')
      && !operationalModule.includes('https://api.github.com')
      && !operationalModule.includes('fs.writeFileSync')),
  ];
}

function selectedStages() {
  const arg = process.argv.find((item) => item.startsWith('--stage='));
  if (!arg) return new Set(['contracts']);
  const stage = arg.split('=')[1];
  if (stage === 'all') return new Set(['contracts']);
  return new Set(stage.split(',').map((item) => item.trim()).filter(Boolean));
}

const stages = selectedStages();
const cases = [
  ...(stages.has('contracts') || stages.has('contract') ? contractTests() : []),
];
const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v131SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

if (process.env.CODEX_QUALITY_REPORT === 'json') {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(`v131SelfTestStatus: ${report.status}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(report.status === 'pass' ? 0 : 1);
}
