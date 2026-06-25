#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch (error) {
    return { name, status: 'fail', reason: error?.message || String(error), safeSummaryOnly: true };
  }
}

function hasUnique(items) {
  return new Set(items).size === items.length;
}

function noMachineBannedTerms(policy) {
  const banned = ['if needed', 'appropriate', 'sufficient', 'high risk', 'minimal change', 'when possible', 'reasonable', 'best effort', 'maybe'];
  const fields = [];
  for (const req of policy.requirements || []) fields.push(req.condition, req.obligation, req.failureCode);
  return !banned.some((word) => fields.some((field) => String(field || '').toLowerCase().includes(word)));
}

function schemaRejectsUnknownFields(schema) {
  const defs = schema.definitions || {};
  return Object.values(defs).every((def) => def && def.additionalProperties === false);
}

function compileRole(policy, role) {
  const profile = policy.roleProfiles?.[role.profileRef];
  if (!profile) return null;
  return {
    roleId: role.roleId,
    capabilityClass: role.capabilityClass,
    allowedTaskClasses: role.allowedTaskClasses,
    sandboxMode: profile.sandboxMode,
    networkMode: profile.networkMode,
    allowedTools: [...new Set([...(profile.allowedTools || []), ...(role.allowedToolsDelta || [])])],
    forbiddenTools: [...new Set([...(profile.forbiddenTools || []), ...(role.forbiddenToolsDelta || [])])],
    writeScope: role.writeScope || profile.writeScope,
    selectedSkillPolicy: profile.selectedSkillPolicy,
    maxInputBytes: role.maxInputBytes || profile.maxInputBytes,
    maxOutputBytes: role.maxOutputBytes || profile.maxOutputBytes,
    maxToolCalls: role.maxToolCalls || profile.maxToolCalls,
    timeoutMs: role.timeoutMs || profile.timeoutMs,
    canSpawn: profile.canSpawn,
    outputSchemaRef: role.outputSchemaRef,
    authorityCreated: role.authorityCreated,
  };
}

function roleComplete(role, policy) {
  const compiled = compileRole(policy, role);
  const required = [
    'roleId',
    'capabilityClass',
    'allowedTaskClasses',
    'sandboxMode',
    'networkMode',
    'allowedTools',
    'forbiddenTools',
    'writeScope',
    'selectedSkillPolicy',
    'maxInputBytes',
    'maxOutputBytes',
    'maxToolCalls',
    'timeoutMs',
    'canSpawn',
    'outputSchemaRef',
    'authorityCreated',
  ];
  return compiled
    && required.every((key) => Object.hasOwn(compiled, key))
    && compiled.authorityCreated === false
    && compiled.canSpawn === false;
}

function contractTests() {
  const policy = readJson('docs/process/CODEX_V130_POLICY.json');
  const schema = readJson('docs/process/CODEX_V130_SCHEMA.json');
  const source = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const docsManifest = readJson('docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicy = readJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const readme = fs.readFileSync('README.md', 'utf8');
  const reqIds = (policy.requirements || []).map((item) => item.requirementId);
  const roleIds = (policy.agentRoles || []).map((item) => item.roleId);
  const incompatibilities = (policy.roleIncompatibilities || []).map((pair) => pair.join('!='));
  const schemaDefs = schema.definitions || {};
  const exact = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  return [
    test('v130_policy_marker_pass', () => policy.marker === 'CODEX_QUALITY_HARNESS_FILE v1.3.0' && policy.schemaVersion === '1.3.0'),
    test('v130_shadow_candidate_state_pass', () => policy.candidateHarnessVersion === '1.3.0' && policy.candidateActivationState === 'source_shadow_candidate' && policy.sourceActivation === 'forbidden'),
    test('v130_final_authority_preserved', () => policy.finalAuthority === 'v1.1.8_final_decision_kernel'),
    test('v130_no_authority_created', () => policy.authorityCreated === false),
    test('v130_monotonic_versions_pass', () => policy.monotonicInheritance?.immediateRollback === '1.2.9' && policy.monotonicInheritance?.blockingCompatibility === '1.2.8' && policy.monotonicInheritance?.legacyCompatibility === '1.2.7'),
    test('v130_no_budget_increase_pass', () => policy.monotonicInheritance?.safeSummaryBudgetIncreaseAllowed === false && policy.tokenBudgets?.safeSummaryBytes === 5600 && policy.tokenBudgets?.routineReadSurfaceBytes === 2500 && policy.tokenBudgets?.routineColdArtifactRead === 0),
    test('v130_baseline_modes_are_execution_modes', () => exact(policy.baselineModes, ['green_required', 'known_red_repair', 'bootstrap_generate_only', 'not_applicable'])),
    test('v130_benchmark_modes_are_separate', () => ['same_model_lift', 'external_frontier_comparator', 'strongest_single_route', 'deterministic_router', 'constrained_learned_router', 'constrained_conductor'].every((mode) => policy.benchmarkModes?.includes(mode)) && !policy.baselineModes.includes('same_model_lift')),
    test('v130_stop_priority_order_pass', () => exact(policy.stopPriority, ['authority_boundary', 'safety_boundary', 'scope_boundary', 'regression', 'observation_invalid', 'baseline_contradiction', 'success', 'repair_exhausted', 'no_progress', 'budget_exhausted'])),
    test('v130_progress_vector_priority_separate', () => exact(policy.progressVectorPriority, ['authority_violation', 'safety_violation', 'regression', 'unmet_required_criteria', 'baseline_failures', 'confirmed_findings', 'evidence_contradictions', 'scope_deltas', 'validation_coverage'])),
    test('v130_no_new_p0_or_status_family', () => policy.monotonicInheritance?.newP0ArtifactCount === 0 && policy.monotonicInheritance?.newTopLevelStatusFamilyCount === 0),
    test('v130_requirements_unique', () => reqIds.length > 10 && hasUnique(reqIds)),
    test('v130_requirements_complete', () => (policy.requirements || []).every((item) => ['requirementId', 'subject', 'condition', 'obligation', 'parameters', 'failureCode'].every((key) => Object.hasOwn(item, key)))),
    test('v130_machine_requirements_no_banned_terms', () => noMachineBannedTerms(policy)),
    test('v130_schema_rejects_unknown_fields', () => schema.duplicateKeyRejectingParseRequired === true && schemaRejectsUnknownFields(schema)),
    test('v130_deep_schema_definitions_present', () => ['v130Policy', 'roleProfile', 'agentRole', 'compiledAgentRole', 'requirement', 'sessionIntent', 'projectProfile', 'gateProvenance', 'goalSoundness', 'acceptanceTrace', 'compiledInstructionEnvelope', 'failureCapsule', 'progressVector', 'contextRequest', 'evidenceHandle', 'typedDag', 'dagNode', 'routeCandidate', 'orchestrationDecision', 'complementarityEntry', 'modelInventory', 'skillInventory', 'pluginInventory', 'escalationReceipt', 'standingDelegation', 'ratificationReceipt', 'stateReceipt', 'environmentAttestation', 'benchmarkResult'].every((key) => schemaDefs[key]?.type === 'object' && schemaDefs[key]?.additionalProperties === false)),
    test('v130_schema_definitions_are_not_empty', () => Object.values(schemaDefs).every((def) => Object.keys(def.properties || {}).length > 0)),
    test('v130_all_roles_compile_complete', () => roleIds.length >= 20 && (policy.agentRoles || []).every((role) => roleComplete(role, policy))),
    test('v130_role_ids_unique', () => hasUnique(roleIds)),
    test('v130_role_incompatibilities_present', () => ['code_worker!=independent_verifier', 'security_patch_worker!=security_patch_reviewer', 'vulnerability_finder!=exploitability_validator'].every((item) => incompatibilities.includes(item))),
    test('v130_role_profiles_present', () => ['read_only_low_cost', 'read_only_high_reasoning', 'read_only_security', 'bounded_code_writer', 'bounded_security_writer', 'independent_verifier_profile', 'authority_reviewer_profile'].every((key) => policy.roleProfiles?.[key])),
    test('v130_code_worker_is_bounded_writer', () => {
      const role = compileRole(policy, policy.agentRoles.find((item) => item.roleId === 'code_worker'));
      return role.sandboxMode === 'workspace_write' && role.writeScope === 'goal_scope_only' && role.networkMode === 'off';
    }),
    test('v130_authority_reviewer_read_only', () => {
      const role = compileRole(policy, policy.agentRoles.find((item) => item.roleId === 'authority_reviewer'));
      return role.sandboxMode === 'read_only' && role.writeScope === 'none' && !role.allowedTools.includes('edit');
    }),
    test('v130_minimum_team_bounds_pass', () => policy.minimumSufficientTeamPolicy?.maxThreads === 4 && policy.minimumSufficientTeamPolicy?.maxDepth === 1 && policy.minimumSufficientTeamPolicy?.parallelWritersMax === 1),
    test('v130_skill_policy_routine_zero', () => policy.skillTrustPolicy?.routineSelectedSkillCount === 0 && policy.tokenBudgets?.routineSkillCount === 0),
    test('v130_plugin_policy_registry_derived', () => policy.pluginTrustPolicy?.requestedPluginsTrusted === false && policy.pluginTrustPolicy?.registryDerivedOnly === true),
    test('v130_cyber_policy_defensive_bound', () => policy.cyberRoutingPolicy?.authorizedDefensiveScopeRequired === true && policy.cyberRoutingPolicy?.secretAccessRequired === false),
    test('v130_escalation_one_time', () => policy.adaptiveEscalationPolicy?.repairIterationMax === 1 && policy.adaptiveEscalationPolicy?.sameBlockerMax === 1),
    test('v130_constrained_dag_policy_pass', () => policy.constrainedDagPolicy?.nodeCountMax === 5 && policy.constrainedDagPolicy?.writerNodeMax === 1 && policy.constrainedDagPolicy?.verifierRequired === true && policy.constrainedDagPolicy?.naturalLanguageWorkflowExecutionAllowed === false),
    test('v130_availability_mask_pass', () => policy.availabilityMaskPolicy?.loadBearingFeatureStage === 'stable' && policy.availabilityMaskPolicy?.silentFallback === false && policy.availabilityMaskPolicy?.underDevelopment === 'forbidden'),
    test('v130_learned_policy_shadow_only', () => policy.offlineLearningPolicy?.learnedPolicyState === 'shadow' && policy.offlineLearningPolicy?.onlineSelfUpdateAllowed === false && policy.offlineLearningPolicy?.modelIdStoredInRepository === false),
    test('v130_no_human_terminals_removed', () => !(policy.noHumanTerminalPolicy?.allowedTerminals || []).includes('human_confirmation_needed') && (policy.noHumanTerminalPolicy?.forbiddenTerminals || []).includes('manual_merge_required')),
    test('v130_source_manifest_shadow_registered', () => source.activeHarnessVersion === '1.2.9' && source.activeSelfTestSuite === 'v129' && source.v130SourceShadowCandidate?.candidateHarnessVersion === '1.3.0'),
    test('v130_docs_manifest_shadow_registered', () => docsManifest.activeHarnessVersion === '1.2.9' && docsManifest.v130SourceShadowCandidate?.candidateActivationState === 'source_shadow_candidate'),
    test('v130_active_policy_shadow_registered', () => activePolicy.activeHarnessVersion === '1.2.9' && activePolicy.v130SourceShadowCandidate?.sourceActivation === 'forbidden'),
    test('v130_readme_state_current', () => readme.includes('Active Source: v1.2.9') && readme.includes('Candidate: v1.3.0 source_shadow_candidate')),
    test('v130_agents_marker_preserves_active_v129', () => fs.readFileSync('AGENTS.md', 'utf8').includes('CODEX_QUALITY_HARNESS_FILE v1.2.9')),
    test('v130_policy_digest_stable', () => /^sha256:[a-f0-9]{64}$/.test(`sha256:${sha256(canonicalJson(policy))}`)),
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
  v130SelfTestStatus: {
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
  console.log(`v130SelfTestStatus: ${report.status}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(report.status === 'pass' ? 0 : 1);
}
