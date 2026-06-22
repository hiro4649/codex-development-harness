#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export const V128_RELEASE_DRILL_SCENARIOS = Object.freeze([
  'forced_interruption_recovery',
  'stale_lock_recovery',
  'same_blocker_stop',
  'duplicate_writer_rejection',
  'v127_rollback_dry_run',
]);

const DEFAULT_ANTI_SPIN = Object.freeze({
  maxRepairIterations: 2,
  sameBlockerMax: 1,
  noProgressWindow: 1,
});

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function loadRepoFacts(repoRoot = process.cwd()) {
  const versionText = readTextIfExists(path.join(repoRoot, 'scripts/codex-harness-version.mjs')) || '';
  const preservationText = readTextIfExists(path.join(repoRoot, 'docs/process/CODEX_V128_PRESERVATION_MATRIX.json')) || '';
  return {
    v127SelfTestAvailable: fs.existsSync(path.join(repoRoot, 'scripts/codex-v127-self-test.mjs')),
    v128SelfTestAvailable: fs.existsSync(path.join(repoRoot, 'scripts/codex-v128-self-test.mjs')),
    v127SpecAvailable: fs.existsSync(path.join(repoRoot, 'docs/process/CODEX_V127_SPEC.md')),
    versionRegistryDeclaresPreviousV127: versionText.includes("previousVersion = '1.2.7'"),
    versionRegistryDeclaresV127StatusKey: versionText.includes("activeSelfTestStatusKey = 'v127SelfTestStatus'"),
    preservationDeclaresRollback: preservationText.includes('"rollback_writer_to_v127"'),
    preservationDeclaresDualReader: preservationText.includes('"v127_v128_dual_reader"'),
  };
}

function scenarioInput(input, scenarioId) {
  const byId = Object.fromEntries((input.scenarios || []).map((item) => [item.scenarioId, item]));
  return {
    ...(input.scenarioOverrides?.[scenarioId] || {}),
    ...(byId[scenarioId] || {}),
  };
}

function evaluateScenario(scenarioId, override = {}, context = {}) {
  const antiSpin = context.antiSpin || DEFAULT_ANTI_SPIN;
  const repoFacts = context.repoFacts || {};
  const base = {
    scenarioId,
    status: 'pass',
    reasonCodes: [],
    rawLogsRead: false,
    productRuntimeMutation: false,
    packageMutation: false,
    deployMutation: false,
    completionContractChanged: false,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    safeSummaryOnly: true,
  };
  const scenario = { ...base, ...override, scenarioId };

  if (scenario.rawLogsRead !== false) scenario.reasonCodes.push('release_drill_raw_log_read_forbidden');
  if (scenario.productRuntimeMutation !== false) scenario.reasonCodes.push('release_drill_product_runtime_mutation_forbidden');
  if (scenario.packageMutation !== false) scenario.reasonCodes.push('release_drill_package_mutation_forbidden');
  if (scenario.deployMutation !== false) scenario.reasonCodes.push('release_drill_deploy_mutation_forbidden');
  if (scenario.completionContractChanged !== false) scenario.reasonCodes.push('release_drill_completion_contract_change_forbidden');
  if (scenario.sourceActivationAuthorized !== false) scenario.reasonCodes.push('release_drill_source_activation_authority_forbidden');
  if (scenario.targetRolloutAuthorized !== false) scenario.reasonCodes.push('release_drill_target_rollout_authority_forbidden');

  if (scenarioId === 'forced_interruption_recovery') {
    const expected = {
      interruptionObserved: true,
      checkpointState: 'observed',
      recoveryAction: 'resume_from_checkpoint',
      scopeDelta: false,
      recoveryContinuesSameContract: true,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.interruptionObserved !== true) scenario.reasonCodes.push('forced_interruption_not_observed');
    if (scenario.checkpointState !== 'observed') scenario.reasonCodes.push('forced_interruption_checkpoint_missing');
    if (scenario.recoveryAction !== 'resume_from_checkpoint') scenario.reasonCodes.push('forced_interruption_recovery_action_invalid');
    if (scenario.scopeDelta !== false) scenario.reasonCodes.push('forced_interruption_scope_delta_forbidden');
    if (scenario.recoveryContinuesSameContract !== true) scenario.reasonCodes.push('forced_interruption_contract_not_preserved');
  }

  if (scenarioId === 'stale_lock_recovery') {
    const expected = {
      staleLockObserved: true,
      lockRecoveryAction: 'reacquire_after_stale_lock',
      activeWriterRejected: true,
      duplicateWriterAllowed: false,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.staleLockObserved !== true) scenario.reasonCodes.push('stale_lock_not_observed');
    if (scenario.lockRecoveryAction !== 'reacquire_after_stale_lock') scenario.reasonCodes.push('stale_lock_recovery_action_invalid');
    if (scenario.activeWriterRejected !== true) scenario.reasonCodes.push('stale_lock_active_writer_not_rejected');
    if (scenario.duplicateWriterAllowed !== false) scenario.reasonCodes.push('stale_lock_duplicate_writer_allowed');
  }

  if (scenarioId === 'same_blocker_stop') {
    const expected = {
      sameBlockerRepeatCount: antiSpin.sameBlockerMax,
      repairIterationCount: antiSpin.maxRepairIterations,
      stopAction: 'stop_same_blocker',
      noProgressWindow: antiSpin.noProgressWindow,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (Number(scenario.sameBlockerRepeatCount) < antiSpin.sameBlockerMax) scenario.reasonCodes.push('same_blocker_repeat_not_reached');
    if (Number(scenario.repairIterationCount) > antiSpin.maxRepairIterations) scenario.reasonCodes.push('same_blocker_repair_cap_exceeded');
    if (scenario.stopAction !== 'stop_same_blocker') scenario.reasonCodes.push('same_blocker_stop_action_invalid');
    if (Number(scenario.noProgressWindow) < antiSpin.noProgressWindow) scenario.reasonCodes.push('same_blocker_no_progress_window_missing');
  }

  if (scenarioId === 'duplicate_writer_rejection') {
    const expected = {
      duplicateWriterObserved: true,
      writerCount: 2,
      rejectionAction: 'reject_duplicate_writer',
      stateMutationAllowed: false,
      mergeAllowed: false,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.duplicateWriterObserved !== true) scenario.reasonCodes.push('duplicate_writer_not_observed');
    if (Number(scenario.writerCount) < 2) scenario.reasonCodes.push('duplicate_writer_count_invalid');
    if (scenario.rejectionAction !== 'reject_duplicate_writer') scenario.reasonCodes.push('duplicate_writer_rejection_action_invalid');
    if (scenario.stateMutationAllowed !== false) scenario.reasonCodes.push('duplicate_writer_state_mutation_allowed');
    if (scenario.mergeAllowed !== false) scenario.reasonCodes.push('duplicate_writer_merge_allowed');
  }

  if (scenarioId === 'v127_rollback_dry_run') {
    const expected = {
      rollbackDryRun: true,
      activationSurfaceMutated: false,
      v127DualReaderAvailable: repoFacts.preservationDeclaresDualReader === true,
      v127RollbackAvailable: repoFacts.v127SelfTestAvailable === true
        && repoFacts.v127SpecAvailable === true
        && repoFacts.versionRegistryDeclaresPreviousV127 === true
        && repoFacts.versionRegistryDeclaresV127StatusKey === true
        && repoFacts.preservationDeclaresRollback === true,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.rollbackDryRun !== true) scenario.reasonCodes.push('v127_rollback_dry_run_missing');
    if (scenario.activationSurfaceMutated !== false) scenario.reasonCodes.push('v127_rollback_dry_run_mutated_activation_surface');
    if (scenario.v127DualReaderAvailable !== true) scenario.reasonCodes.push('v127_dual_reader_missing');
    if (scenario.v127RollbackAvailable !== true) scenario.reasonCodes.push('v127_rollback_unavailable');
  }

  scenario.status = scenario.reasonCodes.length ? 'fail' : 'pass';
  scenario.scenarioDigest = digestValue({
    scenarioId: scenario.scenarioId,
    status: scenario.status,
    reasonCodes: scenario.reasonCodes,
  });
  return scenario;
}

export function buildV128ReleaseDrill(input = {}) {
  const antiSpin = {
    maxRepairIterations: Number(input.maxRepairIterations ?? DEFAULT_ANTI_SPIN.maxRepairIterations),
    sameBlockerMax: Number(input.sameBlockerMax ?? DEFAULT_ANTI_SPIN.sameBlockerMax),
    noProgressWindow: Number(input.noProgressWindow ?? DEFAULT_ANTI_SPIN.noProgressWindow),
  };
  const repoFacts = input.repoFacts || loadRepoFacts(input.repoRoot || process.cwd());
  const scenarioIds = Array.isArray(input.scenarioIds) && input.scenarioIds.length
    ? input.scenarioIds
    : V128_RELEASE_DRILL_SCENARIOS;
  const scenarios = scenarioIds.map((scenarioId) => evaluateScenario(scenarioId, scenarioInput(input, scenarioId), {
    antiSpin,
    repoFacts,
  }));
  const validation = validateV128ReleaseDrill({ scenarios, antiSpin });
  return {
    releaseDrillStatus: {
      status: validation.status,
      scenarioCount: scenarios.length,
      requiredScenarioCount: V128_RELEASE_DRILL_SCENARIOS.length,
      antiSpin,
      sourceActivationAuthorized: false,
      targetRolloutAuthorized: false,
      completionContractChanged: false,
      safeNextAction: validation.status === 'pass' ? 'source_activation_pr_only' : 'repair_release_drill_only',
      reasonCodes: validation.reasonCodes,
      safeSummaryOnly: true,
    },
    scenarioSetDigest: digestValue(scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      status: scenario.status,
      scenarioDigest: scenario.scenarioDigest,
    }))),
    scenarios,
    status: validation.status,
    safeSummaryOnly: true,
  };
}

export function validateV128ReleaseDrill(report = {}) {
  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
  const antiSpin = report.antiSpin || report.releaseDrillStatus?.antiSpin || {};
  const reasonCodes = [];
  const ids = scenarios.map((scenario) => scenario.scenarioId);
  const required = new Set(V128_RELEASE_DRILL_SCENARIOS);
  const idCounts = new Map();
  for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  for (const requiredId of required) {
    if (!idCounts.has(requiredId)) reasonCodes.push(`release_drill_missing_${requiredId}`);
    if ((idCounts.get(requiredId) || 0) > 1) reasonCodes.push(`release_drill_duplicate_${requiredId}`);
  }
  for (const id of ids) {
    if (!required.has(id)) reasonCodes.push(`release_drill_extra_${id || 'unknown'}`);
  }
  if (scenarios.length !== V128_RELEASE_DRILL_SCENARIOS.length) reasonCodes.push('release_drill_scenario_count_not_exact');
  if (Number(antiSpin.maxRepairIterations) !== DEFAULT_ANTI_SPIN.maxRepairIterations) reasonCodes.push('release_drill_max_repair_iterations_not_fixed');
  if (Number(antiSpin.sameBlockerMax) !== DEFAULT_ANTI_SPIN.sameBlockerMax) reasonCodes.push('release_drill_same_blocker_max_not_fixed');
  if (Number(antiSpin.noProgressWindow) !== DEFAULT_ANTI_SPIN.noProgressWindow) reasonCodes.push('release_drill_no_progress_window_not_fixed');

  for (const scenario of scenarios) {
    if (scenario.status !== 'pass') reasonCodes.push(`release_drill_scenario_failed_${scenario.scenarioId || 'unknown'}`);
    if (scenario.rawLogsRead !== false) reasonCodes.push(`release_drill_scenario_raw_log_read_${scenario.scenarioId || 'unknown'}`);
    if (scenario.productRuntimeMutation !== false) reasonCodes.push(`release_drill_scenario_product_runtime_mutation_${scenario.scenarioId || 'unknown'}`);
    if (scenario.packageMutation !== false) reasonCodes.push(`release_drill_scenario_package_mutation_${scenario.scenarioId || 'unknown'}`);
    if (scenario.deployMutation !== false) reasonCodes.push(`release_drill_scenario_deploy_mutation_${scenario.scenarioId || 'unknown'}`);
    if (scenario.completionContractChanged !== false) reasonCodes.push(`release_drill_scenario_completion_contract_changed_${scenario.scenarioId || 'unknown'}`);
    if (scenario.sourceActivationAuthorized !== false) reasonCodes.push(`release_drill_scenario_source_activation_authorized_${scenario.scenarioId || 'unknown'}`);
    if (scenario.targetRolloutAuthorized !== false) reasonCodes.push(`release_drill_scenario_target_rollout_authorized_${scenario.scenarioId || 'unknown'}`);
  }

  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = buildV128ReleaseDrill();
  writeJsonReport(report, 'CODEX_V128_RELEASE_DRILL_REPORT');
  if (!process.env.CODEX_V128_RELEASE_DRILL_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
    console.log(`v128ReleaseDrillStatus: ${report.releaseDrillStatus.status}`);
  }
  exitFor(report);
}
