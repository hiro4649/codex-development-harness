#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  canonicalJson,
  compileGoalContract,
  computeGoalDigest,
  sha256,
  parseJsonRejectDuplicateKeys,
} from './codex-v129-goal-contract.mjs';
import { classifyGoalTask } from './codex-v129-task-classifier.mjs';
import {
  defaultTestRegistry,
  digestRegistry,
  routeCapability,
} from './codex-v129-capability-router.mjs';
import { selectPlugins } from './codex-v129-plugin-broker.mjs';
import {
  buildDispatchRequest,
  digestFile,
  dispatchHost,
  validateInvocationReceipt,
} from './codex-v129-host-dispatch.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch (error) {
    return { name, status: 'fail', reasonCodes: ['self_test_exception', String(error.message || error)], safeSummaryOnly: true };
  }
}

function passed(report) {
  return report?.status === 'pass' || report?.goalContractStatus?.status === 'pass' || report?.classificationStatus?.status === 'pass';
}

function failed(report) {
  return report?.status === 'fail' || report?.goalContractStatus?.status === 'fail' || report?.classificationStatus?.status === 'fail';
}

function baseGoal(overrides = {}) {
  const goal = {
    goalId: 'goal-v129-contract',
    goalVersion: 1,
    taskClass: 'code_change',
    truthOwnerRefs: [
      { path: 'docs/process/CODEX_V129_SPEC.md', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    ],
    desiredEndState: 'Add v1.2.9 source shadow contract without changing active authority.',
    acceptanceCriteria: [
      { id: 'AC1', description: 'v129 contract validates strict JSON.', required: true },
      { id: 'AC2', description: 'v128 compatibility remains pass.', required: true },
    ],
    constraints: ['Do not change activeHarnessVersion.', 'Do not add target rollout.'],
    nonGoals: ['No merge authority.', 'No target repository mutation.'],
    allowedFiles: ['docs/process/CODEX_V129_SPEC.md', 'scripts/codex-v129-goal-contract.mjs'],
    forbiddenFiles: ['scripts/codex-final-decision-kernel.mjs', '.github/workflows/quality-gate.yml'],
    evidencePlan: ['node scripts/codex-v129-self-test.mjs --stage=contract'],
    killCriteria: ['same blocker repeats once'],
    repairBudget: { maxRepairIterations: 1, sameBlockerMax: 1 },
    binding: {
      repositoryId: 1243452288,
      baseSha: '8e74e8d4843dea7ca41bfc50d2e66ad9079fc87d',
      scopeDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    goalDigest: 'placeholder',
    ...overrides,
  };
  goal.goalDigest = computeGoalDigest(goal);
  return goal;
}

function asText(goal) {
  return canonicalJson(goal);
}

function contractTests() {
  const valid = baseGoal();
  const reordered = {};
  for (const key of Object.keys(valid).reverse()) reordered[key] = valid[key];
  return [
    test('v129_valid_goal_compile_pass', () => passed(compileGoalContract(asText(valid)))),
    test('v129_key_order_change_same_digest', () => computeGoalDigest(valid) === computeGoalDigest(reordered)),
    test('v129_goal_tamper_fails', () => failed(compileGoalContract(asText({ ...valid, desiredEndState: 'tampered' })))),
    test('v129_duplicate_key_fails', () => {
      try {
        parseJsonRejectDuplicateKeys('{"goalId":"a","goalId":"b"}');
        return false;
      } catch {
        return true;
      }
    }),
    test('v129_unknown_field_fails', () => failed(compileGoalContract(asText({ ...valid, extraField: true, goalDigest: computeGoalDigest({ ...valid, extraField: true }) })))),
    test('v129_allowed_forbidden_overlap_fails', () => {
      const goal = baseGoal({ forbiddenFiles: ['docs/process/CODEX_V129_SPEC.md'] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_normalized_path_overlap_fails', () => {
      const goal = baseGoal({
        allowedFiles: ['docs/process/CODEX_V129_SPEC.md'],
        forbiddenFiles: ['docs\\process\\CODEX_V129_SPEC.md'],
      });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_absolute_path_fails', () => {
      const goal = baseGoal({ allowedFiles: ['C:/Users/konto/Documents/Codex/HAENESS/HARNESS/scripts/codex-v129-goal-contract.mjs'] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_parent_traversal_path_fails', () => {
      const goal = baseGoal({ allowedFiles: ['docs/process/../CODEX_V129_SPEC.md'] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_empty_path_fails', () => {
      const goal = baseGoal({ allowedFiles: [''] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_nul_path_fails', () => {
      const goal = baseGoal({ allowedFiles: ['docs/process/CODEX_V129_SPEC.md\u0000'] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_acceptance_id_duplicate_fails', () => {
      const goal = baseGoal({ acceptanceCriteria: [
        { id: 'AC1', description: 'one', required: true },
        { id: 'AC1', description: 'two', required: true },
      ] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repair_budget_overflow_fails', () => {
      const goal = baseGoal({ repairBudget: { maxRepairIterations: 2, sameBlockerMax: 1 } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repair_budget_negative_fails', () => {
      const goal = baseGoal({ repairBudget: { maxRepairIterations: -1, sameBlockerMax: 1 } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repository_id_string_fails', () => {
      const goal = baseGoal({ binding: { ...baseGoal().binding, repositoryId: 'hiro4649/codex-development-harness' } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_desired_end_state_non_string_fails', () => {
      const goal = baseGoal({ desiredEndState: { text: 'not-string' } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_truth_owner_duplicate_path_fails', () => {
      const goal = baseGoal({ truthOwnerRefs: [
        { path: 'docs/process/CODEX_V129_SPEC.md', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { path: './docs/process/CODEX_V129_SPEC.md', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_truth_owner_unknown_field_fails', () => {
      const goal = baseGoal({ truthOwnerRefs: [{ path: 'docs/process/CODEX_V129_SPEC.md', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extra: true }] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_truth_owner_digest_missing_fails', () => {
      const goal = baseGoal({ truthOwnerRefs: [{ path: 'docs/process/CODEX_V129_SPEC.md' }] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_acceptance_id_gap_fails', () => {
      const goal = baseGoal({ acceptanceCriteria: [
        { id: 'AC1', description: 'one', required: true },
        { id: 'AC3', description: 'gap', required: true },
      ] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_acceptance_unknown_field_fails', () => {
      const goal = baseGoal({ acceptanceCriteria: [{ id: 'AC1', description: 'one', required: true, extra: true }] });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_repair_budget_unknown_field_fails', () => {
      const goal = baseGoal({ repairBudget: { maxRepairIterations: 1, sameBlockerMax: 1, extra: true } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_binding_unknown_field_fails', () => {
      const goal = baseGoal({ binding: { ...baseGoal().binding, extra: true } });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_array_count_limit_fails', () => {
      const goal = baseGoal({ constraints: Array.from({ length: 25 }, (_, index) => `constraint ${index}`) });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_string_byte_limit_fails', () => {
      const goal = baseGoal({ desiredEndState: 'x'.repeat(1201) });
      return failed(compileGoalContract(asText(goal)));
    }),
    test('v129_authority_file_classifies_authority_change', () => classifyGoalTask(baseGoal({ allowedFiles: ['scripts/codex-final-decision-kernel.mjs'] })).taskClass === 'authority_change'),
    test('v129_authority_prefix_classifies_authority_change', () => classifyGoalTask(baseGoal({ allowedFiles: ['docs/process/CODEX_V129_CAPABILITY_POLICY.json'] })).taskClass === 'authority_change'),
    test('v129_receipt_word_alone_does_not_classify_authority', () => classifyGoalTask(baseGoal({
      allowedFiles: ['README.md'],
      forbiddenFiles: ['docs/private.md'],
      desiredEndState: 'Document receipt formatting for a routine note.',
      constraints: ['receipt word only'],
      nonGoals: ['No release work.'],
      evidencePlan: ['read README'],
      killCriteria: ['stop once'],
    })).taskClass !== 'authority_change'),
    test('v129_authority_like_filename_not_exact_path_does_not_classify_authority', () => classifyGoalTask(baseGoal({
      allowedFiles: ['docs/process/final-decision-kernel-not-authority.md'],
      forbiddenFiles: ['README.md'],
      desiredEndState: 'Change a source helper.',
      constraints: ['keep tests passing'],
      nonGoals: ['No product behavior change.'],
      evidencePlan: ['run focused self-test'],
      killCriteria: ['stop once'],
    })).taskClass !== 'authority_change'),
    test('v129_security_file_classifies_security_task', () => classifyGoalTask(baseGoal({
      allowedFiles: ['docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md'],
      forbiddenFiles: ['README.md'],
      desiredEndState: 'Run a security scan contract.',
      constraints: ['security scan'],
      nonGoals: ['No product change.'],
      evidencePlan: ['safe security report'],
      killCriteria: ['stop once'],
    })).taskClass === 'security_scan'),
    test('v129_metadata_task_classifies_low', () => {
      const report = classifyGoalTask(baseGoal({
        taskClass: 'routine_metadata',
        allowedFiles: ['README.md'],
        forbiddenFiles: ['docs/private.md'],
        desiredEndState: 'metadata manifest update',
        constraints: ['keep current behavior'],
        nonGoals: ['No product behavior change.'],
        evidencePlan: ['review README metadata'],
        killCriteria: ['stop once'],
      }));
      return report.taskClass === 'routine_metadata' && report.difficulty === 'low';
    }),
    test('v129_model_self_claim_difficulty_upgrade_fails', () => failed(classifyGoalTask(valid, { modelClaimedDifficulty: 'critical' }))),
  ];
}

function registryEnv(registry = defaultTestRegistry()) {
  return {
    ...process.env,
    CODEX_V129_CAPABILITY_REGISTRY_JSON: canonicalJson(registry),
    CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST: digestRegistry(registry),
  };
}

function routingTests() {
  const registry = defaultTestRegistry();
  const env = registryEnv(registry);
  const goal = baseGoal({
    desiredEndState: 'Change a source helper.',
    constraints: ['keep tests passing'],
    nonGoals: ['No product behavior change.'],
    allowedFiles: ['scripts/codex-v129-goal-contract.mjs'],
    forbiddenFiles: ['docs/private.md'],
    evidencePlan: ['run focused self-test'],
    killCriteria: ['stop once'],
  });
  const classification = classifyGoalTask(goal);
  const route = routeCapability(classification, env);
  const adapterPath = new URL('./codex-v129-fixture-host-adapter.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const adapterDigest = digestFile(adapterPath);
  const dispatchRequest = buildDispatchRequest({
    goalDigest: goal.goalDigest,
    classificationDigest: classification.classificationDigest,
    routeDecisionDigest: route.routeDecisionDigest,
    registryDigest: route.registryDigest,
    capabilityClass: route.capabilityClass,
    resolvedModelRef: route.resolvedModelRef,
    safeInput: { goalDigest: goal.goalDigest },
    maxOutputBytes: route.maxOutputBytes,
    timeoutMs: 5000,
    workspaceDigest: `sha256:${'3'.repeat(64)}`,
  });
  function authorityEnvFor(classificationInput, overrides = {}) {
    const evidence = {
      schemaVersion: '1.2.9',
      repositoryId: classificationInput.repositoryId,
      goalDigest: classificationInput.goalDigest,
      candidateHeadSha: classificationInput.candidateHeadSha,
      authorizedTaskClass: classificationInput.taskClass,
      expiry: '2999-01-01T00:00:00.000Z',
      authorityEpoch: 1,
      ...overrides,
    };
    return {
      ...env,
      CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_JSON: canonicalJson(evidence),
      CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_DIGEST: `sha256:${sha256(canonicalJson(evidence))}`,
    };
  }
  return [
    test('v129_lowest_sufficient_capability_selected', () => {
      const report = routeCapability(classifyGoalTask(baseGoal({ taskClass: 'routine_metadata', allowedFiles: ['README.md'], forbiddenFiles: ['docs/private.md'], desiredEndState: 'metadata update', constraints: ['keep current behavior'], nonGoals: ['No product change.'], evidencePlan: ['read README'], killCriteria: ['stop once'] })), env);
      return report.status === 'pass' && report.capabilityClass === 'low_cost_worker';
    }),
    test('v129_registry_missing_fails_closed', () => routeCapability(classification, {}).status === 'fail'),
    test('v129_registry_digest_required', () => routeCapability(classification, { CODEX_V129_CAPABILITY_REGISTRY_JSON: canonicalJson(registry) }).status === 'fail'),
    test('v129_registry_digest_mismatch_fails', () => routeCapability(classification, { ...env, CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST: `sha256:${'f'.repeat(64)}` }).status === 'fail'),
    test('v129_duplicate_capability_class_fails', () => {
      const duplicate = { ...registry, capabilities: [...registry.capabilities, registry.capabilities[0]] };
      return routeCapability(classification, registryEnv(duplicate)).status === 'fail';
    }),
    test('v129_duplicate_plugin_id_fails', () => {
      const duplicate = { ...registry, plugins: [...registry.plugins, registry.plugins[0]] };
      return routeCapability(classification, registryEnv(duplicate)).status === 'fail';
    }),
    test('v129_unknown_route_capability_fails', () => {
      const bad = { ...registry, routes: { ...registry.routes, code_change: { ...registry.routes.code_change, requiredCapabilityClasses: ['missing_capability'] } } };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_unknown_top_registry_field_fails', () => {
      const bad = { ...registry, extra: true };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_unknown_nested_registry_field_fails', () => {
      const bad = { ...registry, capabilities: registry.capabilities.map((item, index) => (index === 0 ? { ...item, extra: true } : item)) };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_unknown_plugin_task_class_fails', () => {
      const bad = { ...registry, plugins: registry.plugins.map((plugin) => ({ ...plugin, authorizedTaskClasses: [...plugin.authorizedTaskClasses, 'made_up_task'] })) };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_capability_availability_state_required', () => {
      const bad = { ...registry, capabilities: registry.capabilities.map((item, index) => (index === 0 ? { ...item, availabilityState: 'weird' } : item)) };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_capability_authorization_state_required', () => {
      const bad = { ...registry, capabilities: registry.capabilities.map((item, index) => (index === 0 ? { ...item, authorizationState: 'weird' } : item)) };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_capability_cost_class_required', () => {
      const bad = { ...registry, capabilities: registry.capabilities.map((item, index) => (index === 0 ? { ...item, costClass: 'freeish' } : item)) };
      return routeCapability(classification, registryEnv(bad)).status === 'fail';
    }),
    test('v129_explicit_fallback_pass', () => {
      const fallbackRegistry = { ...registry, capabilities: registry.capabilities.map((cap) => (cap.capabilityClass === 'standard_code_worker' ? { ...cap, availabilityState: 'unavailable' } : cap)) };
      fallbackRegistry.routes = { ...registry.routes, code_change: { ...registry.routes.code_change, fallbackChain: ['high_reasoning_planner'] } };
      const report = routeCapability(classification, registryEnv(fallbackRegistry));
      return report.status === 'pass' && report.capabilityClass === 'high_reasoning_planner' && report.capabilityClasses.includes('independent_verifier');
    }),
    test('v129_undeclared_fallback_fails', () => {
      const missingRegistry = { ...registry, capabilities: registry.capabilities.map((cap) => (cap.capabilityClass === 'standard_code_worker' ? { ...cap, availabilityState: 'unavailable' } : cap)) };
      return routeCapability(classification, registryEnv(missingRegistry)).status === 'fail';
    }),
    test('v129_fallback_cannot_drop_independent_verifier', () => {
      const missingVerifier = { ...registry, capabilities: registry.capabilities.filter((cap) => cap.capabilityClass !== 'independent_verifier') };
      missingVerifier.routes = { ...registry.routes, code_change: { ...registry.routes.code_change, fallbackChain: ['high_reasoning_planner'] } };
      return routeCapability(classification, registryEnv(missingVerifier)).status === 'fail';
    }),
    test('v129_security_plugin_eligible', () => {
      const securityClassification = classifyGoalTask(baseGoal({ allowedFiles: ['docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md'], forbiddenFiles: ['README.md'], desiredEndState: 'security scan', constraints: ['security scan'], nonGoals: ['No product change.'], evidencePlan: ['safe report'], killCriteria: ['stop once'] }));
      const securityRoute = routeCapability(securityClassification, env);
      const report = selectPlugins(securityClassification, securityRoute, authorityEnvFor(securityClassification));
      return report.status === 'pass' && report.selectedPluginIds[0] === 'codex-security';
    }),
    test('v129_requested_plugins_ignored_for_routine', () => {
      const report = selectPlugins({ ...classification, requestedPlugins: ['codex-security'] }, route, env);
      return report.status === 'pass' && report.selectedPluginIds.length === 0;
    }),
    test('v129_plugin_requires_trusted_defensive_evidence', () => {
      const securityClassification = classifyGoalTask(baseGoal({ allowedFiles: ['docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md'], forbiddenFiles: ['README.md'], desiredEndState: 'security scan', constraints: ['security scan'], nonGoals: ['No product change.'], evidencePlan: ['safe report'], killCriteria: ['stop once'] }));
      const securityRoute = routeCapability(securityClassification, env);
      return selectPlugins({ ...securityClassification, authorizedDefensiveScope: true }, securityRoute, env).status === 'fail';
    }),
    test('v129_authority_evidence_digest_mismatch_fails', () => {
      const securityClassification = classifyGoalTask(baseGoal({ allowedFiles: ['docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md'], forbiddenFiles: ['README.md'], desiredEndState: 'security scan', constraints: ['security scan'], nonGoals: ['No product change.'], evidencePlan: ['safe report'], killCriteria: ['stop once'] }));
      const securityRoute = routeCapability(securityClassification, env);
      return selectPlugins(securityClassification, securityRoute, { ...authorityEnvFor(securityClassification), CODEX_V129_TRUSTED_AUTHORITY_EVIDENCE_DIGEST: `sha256:${'f'.repeat(64)}` }).status === 'fail';
    }),
    test('v129_authority_evidence_stale_head_fails', () => {
      const securityClassification = classifyGoalTask(baseGoal({ allowedFiles: ['docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md'], forbiddenFiles: ['README.md'], desiredEndState: 'security scan', constraints: ['security scan'], nonGoals: ['No product change.'], evidencePlan: ['safe report'], killCriteria: ['stop once'] }));
      const securityRoute = routeCapability(securityClassification, env);
      return selectPlugins(securityClassification, securityRoute, authorityEnvFor(securityClassification, { candidateHeadSha: '0'.repeat(40) })).status === 'fail';
    }),
    test('v129_host_adapter_missing_fails', () => dispatchHost(dispatchRequest, { ...env, CODEX_V129_TEST_MODE: '1' }).status === 'fail'),
    test('v129_relative_adapter_path_fails', () => dispatchHost(dispatchRequest, { ...env, CODEX_V129_TEST_MODE: '1', CODEX_V129_HOST_ADAPTER_PATH: 'scripts/codex-v129-fixture-host-adapter.mjs' }).status === 'fail'),
    test('v129_host_adapter_digest_required', () => dispatchHost(dispatchRequest, { ...env, CODEX_V129_TEST_MODE: '1', CODEX_V129_HOST_ADAPTER_PATH: adapterPath }).status === 'fail'),
    test('v129_host_timeout_required', () => dispatchHost({ ...dispatchRequest, timeoutMs: 0 }, { ...env, CODEX_V129_TEST_MODE: '1', CODEX_V129_HOST_ADAPTER_PATH: adapterPath, CODEX_V129_TRUSTED_HOST_ADAPTER_DIGEST: adapterDigest }).status === 'fail'),
    test('v129_adapter_digest_mismatch_fails', () => dispatchHost(dispatchRequest, { ...env, CODEX_V129_TEST_MODE: '1', CODEX_V129_HOST_ADAPTER_PATH: adapterPath, CODEX_V129_TRUSTED_HOST_ADAPTER_DIGEST: `sha256:${'f'.repeat(64)}` }).status === 'fail'),
    test('v129_malformed_receipt_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9' }).status === 'fail'),
    test('v129_receipt_unknown_field_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', extra: true }, { request: dispatchRequest, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_receipt_request_binding_mismatch_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: dispatchRequest.runId, goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', modelInvocationObserved: true, modelInputBytes: dispatchRequest.inputBytes, modelOutputBytes: 10, modelOutputDigest: `sha256:${'4'.repeat(64)}`, workerOutputDigest: `sha256:${'5'.repeat(64)}`, inputDigest: dispatchRequest.inputDigest, inputBytes: dispatchRequest.inputBytes, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: `sha256:${'9'.repeat(64)}`, selectedPluginIds: [], pluginRefs: [], pluginInvocationObserved: false, pluginResultDigest: null, authorityCreated: false }, { request: dispatchRequest, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_missing_model_invocation_observed_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: dispatchRequest.runId, goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', modelInputBytes: dispatchRequest.inputBytes, modelOutputBytes: 10, modelOutputDigest: `sha256:${'4'.repeat(64)}`, workerOutputDigest: `sha256:${'5'.repeat(64)}`, inputDigest: dispatchRequest.inputDigest, inputBytes: dispatchRequest.inputBytes, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: dispatchRequest.workspaceDigest, selectedPluginIds: [], pluginRefs: [], pluginInvocationObserved: false, pluginResultDigest: null, authorityCreated: false }, { request: dispatchRequest, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_missing_worker_output_digest_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: dispatchRequest.runId, goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', modelInvocationObserved: true, modelInputBytes: dispatchRequest.inputBytes, modelOutputBytes: 10, modelOutputDigest: `sha256:${'4'.repeat(64)}`, inputDigest: dispatchRequest.inputDigest, inputBytes: dispatchRequest.inputBytes, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: dispatchRequest.workspaceDigest, selectedPluginIds: [], pluginRefs: [], pluginInvocationObserved: false, pluginResultDigest: null, authorityCreated: false }, { request: dispatchRequest, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_model_output_byte_overflow_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: dispatchRequest.runId, goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', modelInvocationObserved: true, modelInputBytes: dispatchRequest.inputBytes, modelOutputBytes: dispatchRequest.maxOutputBytes + 1, modelOutputDigest: `sha256:${'4'.repeat(64)}`, workerOutputDigest: `sha256:${'5'.repeat(64)}`, inputDigest: dispatchRequest.inputDigest, inputBytes: dispatchRequest.inputBytes, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: dispatchRequest.workspaceDigest, selectedPluginIds: [], pluginRefs: [], pluginInvocationObserved: false, pluginResultDigest: null, authorityCreated: false }, { request: dispatchRequest, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_plugin_selected_but_not_invoked_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: dispatchRequest.runId, goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', modelInvocationObserved: true, modelInputBytes: dispatchRequest.inputBytes, modelOutputBytes: 10, modelOutputDigest: `sha256:${'4'.repeat(64)}`, workerOutputDigest: `sha256:${'5'.repeat(64)}`, inputDigest: dispatchRequest.inputDigest, inputBytes: dispatchRequest.inputBytes, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: dispatchRequest.workspaceDigest, selectedPluginIds: ['codex-security'], pluginRefs: ['codex-security'], pluginInvocationObserved: false, pluginResultDigest: null, authorityCreated: false }, { request: { ...dispatchRequest, pluginRefs: ['codex-security'] }, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_fixture_in_production_fails', () => {
      const report = dispatchHost(dispatchRequest, { ...env, CODEX_V129_TEST_MODE: '1', CODEX_V129_HOST_ADAPTER_PATH: adapterPath, CODEX_V129_TRUSTED_HOST_ADAPTER_DIGEST: adapterDigest });
      return validateInvocationReceipt(report.invocationReceipt, { production: true }).status === 'fail';
    }),
    test('v129_plugin_invocation_count_two_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: 'r', goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', inputDigest: dispatchRequest.inputDigest, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: dispatchRequest.workspaceDigest, modelInvocationObserved: true, selectedPluginIds: ['a', 'b'], pluginRefs: ['a', 'b'], pluginInvocationObserved: false, authorityCreated: false }, { request: { ...dispatchRequest, pluginRefs: ['a', 'b'] }, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_authority_created_true_fails', () => validateInvocationReceipt({ schemaVersion: '1.2.9', runId: 'r', goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest, routeDecisionDigest: route.routeDecisionDigest, registryDigest: route.registryDigest, hostAdapterDigest: adapterDigest, capabilityClass: route.capabilityClass, resolvedModelId: 'registry:model:standard', inputDigest: dispatchRequest.inputDigest, maxOutputBytes: dispatchRequest.maxOutputBytes, workspaceDigest: dispatchRequest.workspaceDigest, modelInvocationObserved: true, selectedPluginIds: [], pluginRefs: [], authorityCreated: true }, { request: dispatchRequest, hostAdapterDigest: adapterDigest }).status === 'fail'),
    test('v129_fixture_host_dispatch_passes_in_test_mode', () => dispatchHost(dispatchRequest, { ...env, CODEX_V129_TEST_MODE: '1', CODEX_V129_HOST_ADAPTER_PATH: adapterPath, CODEX_V129_TRUSTED_HOST_ADAPTER_DIGEST: adapterDigest }).status === 'pass'),
    test('v129_route_decision_digest_stable', () => route.routeDecisionDigest === `sha256:${sha256(canonicalJson({ schemaVersion: '1.2.9', taskClass: route.taskClass, difficulty: route.difficulty, registryDigest: route.registryDigest, capabilityClass: route.capabilityClass, capabilityClasses: route.capabilityClasses, resolvedModelRef: route.resolvedModelRef, maxOutputBytes: route.maxOutputBytes, pluginDefault: route.pluginDefault, eligiblePlugins: route.eligiblePlugins, authorityCreated: false }))}`),
  ];
}

function selectedStages() {
  const arg = process.argv.find((item) => item.startsWith('--stage='));
  if (!arg) return new Set(['contract', 'routing', 'verifier']);
  const stage = arg.split('=')[1];
  if (stage === 'all') return new Set(['contract', 'routing', 'verifier']);
  return new Set(stage.split(',').map((item) => item.trim()).filter(Boolean));
}

const stages = selectedStages();
const cases = [
  ...(stages.has('contract') ? contractTests() : []),
  ...(stages.has('routing') ? routingTests() : []),
];
const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v129SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    stages: [...stages],
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report);
if (process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v129SelfTestStatus: ${report.status}`);
}
exitFor(report.status);
