#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileSessionIntent, buildProjectProfile, compileVerifiedGoal } from './codex-v130-intake-compiler.mjs';
import { buildCompiledInstructionEnvelope } from './codex-v130-context-compiler.mjs';
import { compileV130Skills } from './codex-v130-skill-compiler.mjs';
import { defaultTestRegistry, digestRegistry } from './codex-v129-capability-router.mjs';
import { applyAvailabilityMask, buildConstrainedDag, compileAgentRole, evaluateEscalation, validateConstrainedDag } from './codex-v130-orchestration.mjs';
import { buildProgressVector, buildTransactionalStateReceipt, evaluateNoHumanTerminal, ratifyExactHead } from './codex-v130-ratifier.mjs';
import { buildAdversarialFixture, buildBenchmarkFixture, createTrustedBenchmarkPack, runTrustedBenchmark } from './codex-v130-benchmark.mjs';

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function rejectDuplicateKeys(jsonText) {
  const stack = [];
  let inString = false;
  let escaping = false;
  let token = '';
  let afterString = false;
  for (let i = 0; i < jsonText.length; i += 1) {
    const char = jsonText[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
        afterString = true;
      } else {
        token += char;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      escaping = false;
      token = '';
      afterString = false;
      continue;
    }
    if (char === '{') stack.push({ keys: new Set(), expectKey: true });
    if (char === '}') stack.pop();
    if (char === ',') {
      const top = stack[stack.length - 1];
      if (top) top.expectKey = true;
    }
    if (afterString && char === ':') {
      const top = stack[stack.length - 1];
      if (top?.expectKey) {
        if (top.keys.has(token)) throw new Error(`duplicate key: ${token}`);
        top.keys.add(token);
        top.expectKey = false;
      }
    }
    if (!/\s/.test(char)) afterString = false;
  }
}

function parseJsonStrict(text) {
  rejectDuplicateKeys(text);
  return JSON.parse(text);
}

function readJson(path) {
  return parseJsonStrict(fs.readFileSync(path, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function byteLength(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

function validateSchemaValue(schema, rootName, value, rootSchema = schema, path = rootName) {
  const reasons = [];
  const fail = (code) => reasons.push(`${path}:${code}`);
  const type = rootSchema.type;
  if (rootSchema.$ref) {
    const refName = rootSchema.$ref.replace('#/definitions/', '');
    return validateSchemaValue(schema, rootName, value, schema.definitions?.[refName], path);
  }
  if (rootSchema.enum && !rootSchema.enum.some((item) => canonicalJson(item) === canonicalJson(value))) fail('enum');
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('type');
    const props = rootSchema.properties || {};
    for (const key of rootSchema.required || []) {
      if (!Object.hasOwn(value || {}, key)) reasons.push(`${path}.${key}:required`);
    }
    if (rootSchema.additionalProperties === false) {
      for (const key of Object.keys(value || {})) {
        if (!Object.hasOwn(props, key)) reasons.push(`${path}.${key}:unknown`);
      }
    }
    if (rootSchema.maxProperties !== undefined && Object.keys(value || {}).length > rootSchema.maxProperties) fail('maxProperties');
    for (const [key, child] of Object.entries(props)) {
      if (Object.hasOwn(value || {}, key)) reasons.push(...validateSchemaValue(schema, rootName, value[key], child, `${path}.${key}`));
    }
  }
  if (type === 'array') {
    if (!Array.isArray(value)) fail('type');
    if (rootSchema.maxItems !== undefined && (value || []).length > rootSchema.maxItems) fail('maxItems');
    if (rootSchema.uniqueItems === true && new Set((value || []).map(canonicalJson)).size !== (value || []).length) fail('uniqueItems');
    for (const [index, item] of (value || []).entries()) reasons.push(...validateSchemaValue(schema, rootName, item, rootSchema.items || {}, `${path}[${index}]`));
  }
  if (type === 'string') {
    if (typeof value !== 'string') fail('type');
    if (rootSchema.minLength !== undefined && String(value).length < rootSchema.minLength) fail('minLength');
    if (rootSchema.maxLength !== undefined && String(value).length > rootSchema.maxLength) fail('maxLength');
    if (rootSchema.pattern && !(new RegExp(rootSchema.pattern).test(String(value)))) fail('pattern');
  }
  if (type === 'integer') {
    if (!Number.isInteger(value)) fail('type');
    if (rootSchema.minimum !== undefined && value < rootSchema.minimum) fail('minimum');
    if (rootSchema.maximum !== undefined && value > rootSchema.maximum) fail('maximum');
  }
  if (type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) fail('type');
    if (rootSchema.minimum !== undefined && value < rootSchema.minimum) fail('minimum');
    if (rootSchema.maximum !== undefined && value > rootSchema.maximum) fail('maximum');
  }
  if (type === 'boolean' && typeof value !== 'boolean') fail('type');
  return reasons;
}

function validateByDefinition(schema, definitionName, value) {
  const definition = schema.definitions?.[definitionName];
  if (!definition) return [`${definitionName}:missing_definition`];
  return validateSchemaValue(schema, definitionName, value, definition);
}

function validateByteBudget(value, maxBytes) {
  const bytes = Buffer.byteLength(String(value), 'utf8');
  return { status: bytes <= maxBytes ? 'pass' : 'fail', bytes, maxBytes };
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
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  const policyBytes = byteLength(fs.readFileSync('docs/process/CODEX_V130_POLICY.json', 'utf8'));
  const schemaBytes = byteLength(fs.readFileSync('docs/process/CODEX_V130_SCHEMA.json', 'utf8'));
  const specBytes = byteLength(fs.readFileSync('docs/process/CODEX_V130_SPEC.md', 'utf8'));
  const reqIds = (policy.requirements || []).map((item) => item.requirementId);
  const roleIds = (policy.agentRoles || []).map((item) => item.roleId);
  const incompatibilities = (policy.roleIncompatibilities || []).map((pair) => pair.join('!='));
  const schemaDefs = schema.definitions || {};
  const skillRegistry = compileV130Skills();
  const exact = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  const policyUnknown = JSON.parse(JSON.stringify(policy));
  policyUnknown.monotonicInheritance.extraNestedField = true;
  const policyBadEnum = { ...policy, candidateActivationState: 'activated_by_candidate' };
  const roleOverBudget = { ...policy.agentRoles[0], roleId: 'x'.repeat(97) };
  const duplicateText = '{"a":1,"a":2}';
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
    test('v130_policy_binds_curated_skill_registry', () => skillRegistry.status === 'pass' && policy.skillTrustPolicy?.skillRegistryDigest === skillRegistry.skillRegistryDigest && policy.skillTrustPolicy?.catalogProjectionBytes === skillRegistry.registry.catalogProjectionBytes),
    test('v130_requirements_unique', () => reqIds.length > 10 && hasUnique(reqIds)),
    test('v130_requirements_complete', () => (policy.requirements || []).every((item) => ['requirementId', 'subject', 'condition', 'obligation', 'parameters', 'failureCode'].every((key) => Object.hasOwn(item, key)))),
    test('v130_machine_requirements_no_banned_terms', () => noMachineBannedTerms(policy)),
    test('v130_schema_rejects_unknown_fields', () => schema.duplicateKeyRejectingParseRequired === true && schemaRejectsUnknownFields(schema)),
    test('v130_deep_schema_definitions_present', () => ['v130Policy', 'roleProfile', 'agentRole', 'compiledAgentRole', 'requirement', 'sessionIntent', 'projectProfile', 'gateProvenance', 'goalSoundness', 'acceptanceTrace', 'compiledInstructionEnvelope', 'failureCapsule', 'progressVector', 'contextRequest', 'evidenceHandle', 'typedDag', 'dagNode', 'routeCandidate', 'orchestrationDecision', 'complementarityEntry', 'modelInventory', 'skillInventory', 'pluginInventory', 'escalationReceipt', 'standingDelegation', 'ratificationReceipt', 'stateReceipt', 'environmentAttestation', 'benchmarkResult'].every((key) => schemaDefs[key]?.type === 'object' && schemaDefs[key]?.additionalProperties === false)),
    test('v130_schema_definitions_are_not_empty', () => Object.values(schemaDefs).every((def) => Object.keys(def.properties || {}).length > 0)),
    test('v130_policy_size_budget_pass', () => policyBytes <= 32768),
    test('v130_schema_size_budget_pass', () => schemaBytes <= 24576),
    test('v130_spec_size_budget_pass', () => specBytes <= 16384),
    test('v130_agents_size_budget_pass', () => byteLength(agents) <= 3072),
    test('v130_policy_deep_schema_validation_pass', () => validateByDefinition(schema, 'v130Policy', policy).length === 0),
    test('v130_schema_rejects_nested_unknown_field', () => validateByDefinition(schema, 'v130Policy', policyUnknown).some((reason) => reason.includes('unknown'))),
    test('v130_schema_rejects_wrong_enum', () => validateByDefinition(schema, 'v130Policy', policyBadEnum).some((reason) => reason.includes('enum'))),
    test('v130_schema_rejects_over_budget_string', () => validateByDefinition(schema, 'agentRole', roleOverBudget).some((reason) => reason.includes('maxLength'))),
    test('v130_duplicate_key_parser_rejects_duplicate', () => {
      try {
        parseJsonStrict(duplicateText);
        return false;
      } catch {
        return true;
      }
    }),
    test('v130_orchestration_48000_bytes_pass', () => validateByteBudget('x'.repeat(48000), 48000).status === 'pass'),
    test('v130_orchestration_48001_bytes_fail', () => validateByteBudget('x'.repeat(48001), 48000).status === 'fail'),
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
    test('v130_agents_marker_preserves_active_v129', () => agents.includes('CODEX_QUALITY_HARNESS_FILE v1.2.9') && agents.includes('Candidate Source: v1.3.0 source_shadow_candidate')),
    test('v130_policy_digest_stable', () => /^sha256:[a-f0-9]{64}$/.test(`sha256:${sha256(canonicalJson(policy))}`)),
  ];
}

function intakeContextTests() {
  const candidateHeadSha = '1'.repeat(40);
  const repositoryId = 1243452288;
  const docsManifestForIntake = readJson('docs/process/CODEX_HARNESS_MANIFEST.json');
  const registry = defaultTestRegistry();
  const routingEnv = {
    CODEX_V129_CAPABILITY_REGISTRY_JSON: canonicalJson(registry),
    CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST: digestRegistry(registry),
  };
  const intent = compileSessionIntent({
    currentGoal: 'Add v1.3.0 verified goal intake.',
    explicitNonGoals: ['No target rollout.'],
    safeEvidenceRefs: ['docs/process/CODEX_V130_POLICY.json'],
  });
  const profile = buildProjectProfile({ repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) });
  const goalCandidate = {
    goalId: 'goal-v130-intake-closure',
    goalVersion: 1,
    taskClass: 'code_change',
    truthOwnerRefs: profile.projectProfile.truthOwnerRefs.slice(0, 2),
    desiredEndState: 'Close v1.3.0 goal intake contracts with executable gate evidence.',
    acceptanceCriteria: [{ id: 'AC1', description: 'Executable intake-context gate proves the v1.3.0 intake contract.', required: true }],
    constraints: ['Preserve active v1.2.9 authority until explicit activation.'],
    nonGoals: ['No target rollout.'],
    allowedFiles: ['docs/process/CODEX_V130_POLICY.json', 'docs/process/CODEX_V130_SCHEMA.json', 'scripts/codex-v130-intake-compiler.mjs', 'scripts/codex-v130-context-compiler.mjs', 'scripts/codex-v130-self-test.mjs'],
    forbiddenFiles: ['scripts/codex-final-decision-kernel.mjs', 'package.json', 'package-lock.json'],
    evidencePlan: ['node scripts/codex-v130-self-test.mjs --stage=intake-context'],
    killCriteria: ['same blocker repeats once'],
    repairBudget: { maxRepairIterations: 1, sameBlockerMax: 1 },
    binding: { repositoryId, baseSha: '0'.repeat(40), scopeDigest: profile.projectProfile.profileDigest },
  };
  const acceptanceTraceCandidate = [{
    criterionId: 'AC1',
    truthOwnerRef: goalCandidate.truthOwnerRefs[0].path,
    gateRef: 'v130-intake-context',
    evidenceType: 'executable_gate',
    expectedPredicate: 'exit_code_zero_and_contract_status_pass',
    verifierRole: 'independent_contract_verifier',
    required: true,
  }];
  const verifierReceiptBase = {
    schemaVersion: '1.3.0',
    goalCandidateDigest: `sha256:${sha256(canonicalJson(goalCandidate))}`,
    projectProfileDigest: profile.projectProfile.profileDigest,
    candidateHeadSha,
    verifierAgentId: 'verifier-agent',
    verifierThreadDigest: `sha256:${'2'.repeat(64)}`,
    verifierWorktreeDigest: `sha256:${'3'.repeat(64)}`,
    synthesizerAgentId: 'synthesizer-agent',
    synthesizerThreadDigest: `sha256:${'4'.repeat(64)}`,
    synthesizerWorktreeDigest: `sha256:${'5'.repeat(64)}`,
    goalDigestRecomputed: `sha256:${'6'.repeat(64)}`,
    scopeDigestRecomputed: profile.projectProfile.profileDigest,
    gateProvenanceDigest: `sha256:${sha256(canonicalJson(profile.projectProfile.verificationGates))}`,
    acceptanceTraceDigest: `sha256:${sha256(canonicalJson(acceptanceTraceCandidate))}`,
    status: 'pass',
    reasonCodes: [],
    authorityCreated: false,
    receiptDigest: 'placeholder',
  };
  verifierReceiptBase.receiptDigest = `sha256:${sha256(canonicalJson({ ...verifierReceiptBase, receiptDigest: 'placeholder' }))}`;
  const gateAdequacyEvidence = {
    preFixFailureReproduced: true,
    postFixPass: true,
    existingPassRetained: true,
    changedSurfaceCovered: true,
    assertionWeakening: 0,
    skipIncrease: 0,
    snapshotRubberStamp: 0,
    mockOnlyCompletion: 0,
    testDeletion: 0,
    requiredCheckDeletion: 0,
    difficulty: 'medium',
    existingInvariant: true,
  };
  const goal = compileVerifiedGoal({
    currentGoal: 'Add v1.3.0 verified goal intake.',
    explicitNonGoals: ['No target rollout.'],
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate,
    acceptanceTraceCandidate,
    gateAdequacyEvidence,
  }, { candidateHeadSha, routingEnv, verifierReceipt: verifierReceiptBase });
  const rawRejected = compileSessionIntent({ currentGoal: 'x', rawLogs: 'forbidden' });
  const unknownRejected = compileSessionIntent({ currentGoal: 'x', surprise: true });
  const badHead = compileVerifiedGoal({ currentGoal: 'x' }, { candidateHeadSha: 'not-a-sha' });
  const missingRepoProfile = buildProjectProfile({ headSha: candidateHeadSha, baseSha: '0'.repeat(40), repositoryId: 0 });
  const missingGoalCandidate = compileVerifiedGoal({
    currentGoal: 'Add v1.3.0 verified goal intake.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
  }, { candidateHeadSha, routingEnv, verifierReceipt: verifierReceiptBase });
  const missingVerifier = compileVerifiedGoal({
    currentGoal: 'Add v1.3.0 verified goal intake.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate,
    acceptanceTraceCandidate,
    gateAdequacyEvidence,
  }, { candidateHeadSha, routingEnv });
  const sameThreadVerifier = compileVerifiedGoal({
    currentGoal: 'Add v1.3.0 verified goal intake.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate,
    acceptanceTraceCandidate,
    gateAdequacyEvidence,
  }, { candidateHeadSha, routingEnv, verifierReceipt: { ...verifierReceiptBase, verifierThreadDigest: verifierReceiptBase.synthesizerThreadDigest, receiptDigest: verifierReceiptBase.receiptDigest } });
  const readmeGate = compileVerifiedGoal({
    currentGoal: 'Reject README-only command authority.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate: {
      ...goalCandidate,
      evidencePlan: ['README says run this command'],
    },
    acceptanceTraceCandidate: [{
      ...acceptanceTraceCandidate[0],
      gateRef: 'README',
    }],
    gateAdequacyEvidence,
  }, { candidateHeadSha, routingEnv, verifierReceipt: verifierReceiptBase });
  const rubberStampTrace = compileVerifiedGoal({
    currentGoal: 'Reject rubber stamp trace.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate,
    acceptanceTraceCandidate: [{ ...acceptanceTraceCandidate[0], expectedPredicate: 'pass' }],
    gateAdequacyEvidence,
  }, { candidateHeadSha, routingEnv, verifierReceipt: verifierReceiptBase });
  const gateWeakening = compileVerifiedGoal({
    currentGoal: 'Reject gate weakening.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate,
    acceptanceTraceCandidate,
    gateAdequacyEvidence: {
      ...gateAdequacyEvidence,
      assertionWeakening: 1,
    },
  }, { candidateHeadSha, routingEnv, verifierReceipt: verifierReceiptBase });
  const mockOnly = compileVerifiedGoal({
    currentGoal: 'Reject mock-only completion.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate,
    acceptanceTraceCandidate,
    gateAdequacyEvidence: {
      ...gateAdequacyEvidence,
      mockOnlyCompletion: 1,
    },
  }, { candidateHeadSha, routingEnv, verifierReceipt: verifierReceiptBase });
  const subjective = compileVerifiedGoal({
    currentGoal: 'Reject subjective completion.',
    profile: { repositoryId, headSha: candidateHeadSha, baseSha: '0'.repeat(40) },
    goalCandidate: {
      ...goalCandidate,
      acceptanceCriteria: [{ id: 'AC1', description: 'LGTM by model opinion.', required: true }],
      evidencePlan: ['README says run this command'],
    },
    acceptanceTraceCandidate,
    gateAdequacyEvidence,
  }, { candidateHeadSha, routingEnv });
  const envelope = buildCompiledInstructionEnvelope();
  const workerEnvelope = buildCompiledInstructionEnvelope({ roleId: 'code_worker', actionClass: 'write' });
  const verifierEnvelope = buildCompiledInstructionEnvelope({ roleId: 'independent_verifier', actionClass: 'verify' });
  const oversizedEnvelope = buildCompiledInstructionEnvelope({ evidenceHandles: Array.from({ length: 12 }, (_, i) => `evidence-${i}-${'x'.repeat(120)}`) });
  const skillRegistry = compileV130Skills();
  return [
    test('v130_session_intent_compiles_under_budget', () => intent.status === 'pass' && intent.canonicalBytes <= 1536 && /^sha256:[a-f0-9]{64}$/.test(intent.sessionIntent.intentDigest)),
    test('v130_session_intent_rejects_raw_logs', () => rawRejected.status === 'fail' && rawRejected.reasonCodes.includes('v130_forbidden_rawLogs')),
    test('v130_session_intent_rejects_unknown_fields', () => unknownRejected.status === 'fail' && unknownRejected.reasonCodes.includes('v130_session_intent_unknown_surprise')),
    test('v130_project_profile_read_only_bounded', () => profile.status === 'pass' && profile.canonicalBytes <= 8192 && profile.projectProfile.dirtyState !== undefined),
    test('v130_project_profile_rejects_missing_repository_id', () => missingRepoProfile.status === 'fail' && missingRepoProfile.reasonCodes.includes('v130_repository_id_unavailable')),
    test('v130_verified_goal_uses_v129_contract', () => goal.status === 'pass' && goal.goalContractStatus.status === 'pass' && /^sha256:[a-f0-9]{64}$/.test(goal.goalDigest)),
    test('v130_goal_candidate_missing_fails', () => missingGoalCandidate.status === 'fail' && missingGoalCandidate.reasonCodes.includes('v130_goal_candidate_missing')),
    test('v130_verified_goal_requires_runtime_candidate_head', () => badHead.status === 'fail' && badHead.reasonCodes.includes('v130_candidate_head_invalid')),
    test('v130_classification_receives_candidate_head', () => goal.classificationStatus.status === 'pass' && /^sha256:[a-f0-9]{64}$/.test(goal.classificationStatus.classificationDigest)),
    test('v130_goal_requires_independent_contract_verifier', () => missingVerifier.status === 'fail' && missingVerifier.reasonCodes.includes('v130_verifier_receipt_missing')),
    test('v130_same_verifier_thread_fails', () => sameThreadVerifier.status === 'fail' && sameThreadVerifier.reasonCodes.includes('v130_verifier_thread_not_independent')),
    test('v130_readme_only_command_not_authoritative', () => readmeGate.status === 'fail' && readmeGate.reasonCodes.includes('v130_untrusted_gate_command')),
    test('v130_rubber_stamp_trace_fails', () => rubberStampTrace.status === 'fail' && rubberStampTrace.reasonCodes.includes('v130_acceptance_trace_rubber_stamp')),
    test('v130_gate_weakening_fails', () => gateWeakening.status === 'fail' && gateWeakening.reasonCodes.includes('v130_gate_adequacy_assertionWeakening_forbidden')),
    test('v130_mock_only_completion_fails', () => mockOnly.status === 'fail' && mockOnly.reasonCodes.includes('v130_gate_adequacy_mockOnlyCompletion_forbidden')),
    test('v130_subjective_completion_fails', () => subjective.status === 'fail' && subjective.reasonCodes.includes('v130_subjective_completion_forbidden')),
    test('v130_instruction_envelope_under_budget', () => envelope.status === 'pass' && envelope.canonicalBytes <= 1536 && envelope.compiledInstructionEnvelope.routineReads.length === 3),
    test('v130_role_specific_envelope_differs_by_role', () => workerEnvelope.compiledInstructionEnvelope.instructionDigest !== verifierEnvelope.compiledInstructionEnvelope.instructionDigest),
    test('v130_instruction_envelope_reads_active_version_from_manifest', () => envelope.compiledInstructionEnvelope.activeHarnessVersion === docsManifestForIntake.activeHarnessVersion),
    test('v130_instruction_envelope_forbids_routine_cold_reads', () => envelope.compiledInstructionEnvelope.tokenBudgets.routineColdArtifactReads === 0 && envelope.compiledInstructionEnvelope.tokenBudgets.routineSkillCount === 0),
    test('v130_instruction_envelope_over_budget_fails', () => oversizedEnvelope.status === 'fail' && oversizedEnvelope.reasonCodes.includes('v130_instruction_envelope_over_budget')),
    test('v130_curated_skill_registry_pass', () => skillRegistry.status === 'pass' && skillRegistry.registry.skillCount === 6 && /^sha256:[a-f0-9]{64}$/.test(skillRegistry.skillRegistryDigest)),
    test('v130_skill_catalog_projection_under_budget', () => skillRegistry.registry.catalogProjectionBytes <= 512),
    test('v130_skills_forbid_implicit_invocation', () => skillRegistry.registry.entries.every((entry) => entry.allowImplicitInvocation === false && entry.authorityCreated === false)),
  ];
}

function orchestrationAutonomyTests() {
  const policy = readJson('docs/process/CODEX_V130_POLICY.json');
  const direct = buildConstrainedDag(policy, { taskClass: 'code_change' });
  const security = buildConstrainedDag(policy, { taskClass: 'security_remediation' });
  const naturalLanguage = buildConstrainedDag(policy, { taskClass: 'code_change', naturalLanguageWorkflow: true });
  const secondReplan = buildConstrainedDag(policy, { taskClass: 'architecture', replanCount: 2 });
  const cycleDag = validateConstrainedDag(policy, {
    nodes: [
      { nodeId: 'writer', roleId: 'code_worker', inputHandles: ['verifier'], outputSchemaRef: 'change_receipt', timeoutMs: 1 },
      { nodeId: 'verifier', roleId: 'independent_verifier', inputHandles: ['writer'], outputSchemaRef: 'verification_receipt', timeoutMs: 1 },
    ],
    edges: [
      { from: 'writer', to: 'verifier', handleType: 'evidence_handle' },
      { from: 'verifier', to: 'writer', handleType: 'evidence_handle' },
    ],
  });
  const twoWriterDag = validateConstrainedDag(policy, {
    nodes: [
      { nodeId: 'writer1', roleId: 'code_worker', inputHandles: ['goal'], outputSchemaRef: 'change_receipt', timeoutMs: 1 },
      { nodeId: 'writer2', roleId: 'test_worker', inputHandles: ['writer1'], outputSchemaRef: 'change_receipt', timeoutMs: 1 },
      { nodeId: 'verifier', roleId: 'independent_verifier', inputHandles: ['writer2'], outputSchemaRef: 'verification_receipt', timeoutMs: 1 },
    ],
    edges: [
      { from: 'writer1', to: 'writer2', handleType: 'evidence_handle' },
      { from: 'writer2', to: 'verifier', handleType: 'evidence_handle' },
    ],
  });
  const rawBroadcastDag = validateConstrainedDag(policy, {
    nodes: [
      { nodeId: 'writer', roleId: 'code_worker', inputHandles: ['goal'], outputSchemaRef: 'change_receipt', timeoutMs: 1, modelId: 'forbidden-model' },
      { nodeId: 'verifier', roleId: 'independent_verifier', inputHandles: ['writer'], outputSchemaRef: 'verification_receipt', timeoutMs: 1 },
    ],
    edges: [{ from: 'writer', to: 'verifier', handleType: 'raw_output' }],
  }, { goalMutation: true, gateRemoval: true, budgetExpansion: true, finalDecisionReplacement: true });
  const role = compileAgentRole(policy, 'code_worker');
  const missingVerifierMask = applyAvailabilityMask(policy, {
    roles: [
      { roleId: 'code_worker', available: true, authorized: true, featureStage: 'stable' },
    ],
  }, direct.dag);
  const fullMask = applyAvailabilityMask(policy, {
    roles: direct.dag.nodes.map((node) => ({ roleId: node.roleId, available: true, authorized: true, featureStage: 'stable' })),
  }, direct.dag);
  const escalation = evaluateEscalation(policy, { failureClass: 'reasoning_insufficient', escalationCount: 0 });
  const secondEscalation = evaluateEscalation(policy, { failureClass: 'reasoning_insufficient', escalationCount: 1 });
  const providerEscalation = evaluateEscalation(policy, { failureClass: 'provider_transient', escalationCount: 0 });
  const terminal = evaluateNoHumanTerminal(policy, 'manual_merge_required');
  const completeRatificationInput = {
    repositoryId: 1,
    goalDigest: 'sha256:' + 'a'.repeat(64),
    baseSha: '0'.repeat(40),
    candidateHeadSha: '1'.repeat(40),
    observedHeadSha: '1'.repeat(40),
    policyDigest: 'sha256:' + 'b'.repeat(64),
    requiredChecksDigest: 'sha256:' + 'c'.repeat(64),
    specialistReceiptDigests: ['sha256:' + 'd'.repeat(64)],
    realHostReceiptDigest: 'sha256:' + 'e'.repeat(64),
    benchmarkReceiptDigest: 'sha256:' + 'f'.repeat(64),
    rollbackPlanDigest: 'sha256:' + '1'.repeat(64),
    authorityEpoch: 'v129-trusted',
    revocationNonce: 'nonce-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    decision: 'ratify',
    requiredChecksPass: true,
    previousTrustedPolicy: '1.2.9',
    authorityCreated: false,
  };
  const ratified = ratifyExactHead(policy, completeRatificationInput);
  const stale = ratifyExactHead(policy, { ...completeRatificationInput, observedHeadSha: '2'.repeat(40) });
  const booleanOnlyRatification = ratifyExactHead(policy, { candidateHeadSha: '1'.repeat(40), observedHeadSha: '1'.repeat(40), requiredChecksPass: true, previousTrustedPolicy: '1.2.9', authorityCreated: false });
  const selfAuth = ratifyExactHead(policy, { candidateHeadSha: '1'.repeat(40), observedHeadSha: '1'.repeat(40), requiredChecksPass: true, previousTrustedPolicy: '1.3.0', candidatePolicySelfAuthorization: true });
  const stateReceipt = buildTransactionalStateReceipt({ goalDigest: 'sha256:' + 'a'.repeat(64), candidateHeadSha: '1'.repeat(40), treeDigest: 'sha256:' + 'b'.repeat(64) });
  const progress = buildProgressVector({ validationCoverageCount: 2 });
  return [
    test('v130_direct_lane_no_conductor', () => direct.status === 'pass' && direct.dag.lane === 'direct_verified' && direct.dag.nodes.length === 2),
    test('v130_security_lane_is_constrained', () => security.status === 'pass' && security.dag.lane === 'constrained_orchestrated' && security.dag.nodes.some((node) => node.roleId === 'independent_security_verifier')),
    test('v130_natural_language_workflow_forbidden', () => naturalLanguage.status === 'fail' && naturalLanguage.reasonCodes.includes('v130_natural_language_workflow_forbidden')),
    test('v130_second_replan_forbidden', () => secondReplan.status === 'fail' && secondReplan.reasonCodes.includes('v130_replan_limit_exceeded')),
    test('v130_dag_cycle_forbidden', () => cycleDag.status === 'fail' && cycleDag.reasonCodes.includes('v130_dag_cycle_forbidden')),
    test('v130_parallel_writer_forbidden', () => twoWriterDag.status === 'fail' && twoWriterDag.reasonCodes.includes('v130_parallel_writer_forbidden')),
    test('v130_raw_output_model_id_goal_gate_budget_final_decision_forbidden', () => rawBroadcastDag.status === 'fail'
      && rawBroadcastDag.reasonCodes.includes('v130_raw_output_broadcast_forbidden')
      && rawBroadcastDag.reasonCodes.includes('v130_model_id_in_plan_forbidden')
      && rawBroadcastDag.reasonCodes.includes('v130_goal_mutation_forbidden')
      && rawBroadcastDag.reasonCodes.includes('v130_gate_removal_forbidden')
      && rawBroadcastDag.reasonCodes.includes('v130_budget_expansion_forbidden')
      && rawBroadcastDag.reasonCodes.includes('v130_final_decision_replacement_forbidden')),
    test('v130_code_worker_compiles_from_profile', () => role.status === 'pass' && role.compiledRole.sandboxMode === 'workspace_write' && role.compiledRole.authorityCreated === false),
    test('v130_availability_mask_requires_verifier', () => missingVerifierMask.status === 'fail' && missingVerifierMask.reasonCodes.includes('v130_mask_removed_verifier')),
    test('v130_availability_mask_passes_complete_stable_inventory', () => fullMask.status === 'pass' && fullMask.silentFallback === false),
    test('v130_one_capability_escalation_allowed', () => escalation.status === 'pass' && escalation.escalationCount === 1),
    test('v130_second_capability_escalation_forbidden', () => secondEscalation.status === 'fail' && secondEscalation.reasonCodes.includes('v130_second_escalation_forbidden')),
    test('v130_provider_transient_does_not_escalate_model', () => providerEscalation.status === 'fail' && providerEscalation.reasonCodes.includes('v130_escalation_failure_class_forbidden')),
    test('v130_human_terminal_forbidden', () => terminal.status === 'fail' && terminal.terminal === 'auto_reject'),
    test('v130_exact_head_ratification_pass', () => ratified.status === 'pass' && ratified.receipt.exactHead === true),
    test('v130_exact_head_mismatch_fails', () => stale.status === 'fail' && stale.reasonCodes.includes('v130_exact_head_mismatch')),
    test('v130_boolean_only_ratification_fails', () => booleanOnlyRatification.status === 'fail' && booleanOnlyRatification.reasonCodes.includes('v130_ratification_goalDigest_missing')),
    test('v130_candidate_policy_self_authorization_fails', () => selfAuth.status === 'fail' && selfAuth.reasonCodes.includes('v130_candidate_policy_self_authorization')),
    test('v130_transactional_state_receipt_pass', () => stateReceipt.status === 'pass' && /^sha256:[a-f0-9]{64}$/.test(stateReceipt.receipt.receiptDigest)),
    test('v130_progress_vector_digest_pass', () => /^sha256:[a-f0-9]{64}$/.test(progress.progressDigest)),
  ];
}

function tokenDifferentialTests() {
  const pass = buildBenchmarkFixture({ comparatorAvailable: false });
  const insufficientTasks = buildBenchmarkFixture({ taskCount: 30 });
  const tokenRegression = buildBenchmarkFixture({ inputTokensPerAcceptedChangeP50: 900 });
  const authorityViolation = buildBenchmarkFixture({ authorityViolations: 1 });
  const pack = createTrustedBenchmarkPack();
  const trusted = runTrustedBenchmark({ pack: pack.packRoot, packDigest: pack.packDigest });
  const digestMismatch = runTrustedBenchmark({ pack: pack.packRoot, packDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' });
  return [
    test('v130_same_model_lift_fixture_is_not_activation_eligible', () => pass.status === 'pass' && pass.result.fixture === true && pass.result.activationEligible === false && pass.result.sameModelLiftEvidenceState === 'fixture_only'),
    test('v130_fable_comparator_unavailable_no_superiority_claim', () => pass.result.externalComparator.comparatorState === 'unavailable' && pass.result.externalComparator.superiorityClaimState === 'not_proven'),
    test('v130_fixture_learned_policy_shadow_only', () => pass.result.learnedPolicyQualification.learnedPolicyState === 'shadow_only' && pass.result.learnedPolicyState === 'shadow_only'),
    test('v130_external_trusted_pack_passes_activation_benchmark', () => trusted.status === 'pass' && trusted.result.fixture === false && trusted.result.activationEligible === true && trusted.result.taskCount >= 60),
    test('v130_external_pack_digest_mismatch_fails', () => digestMismatch.status === 'fail' && digestMismatch.reasonCodes.includes('v130_benchmark_pack_digest_mismatch')),
    test('v130_insufficient_task_count_fails_lift', () => insufficientTasks.status === 'fail' && insufficientTasks.reasonCodes.includes('v130_same_model_lift_not_met')),
    test('v130_token_regression_fails_lift', () => tokenRegression.status === 'fail'),
    test('v130_authority_violation_fails_lift', () => authorityViolation.status === 'fail'),
  ];
}

function adversarialBenchmarkTests() {
  const pass = buildAdversarialFixture();
  const fail = buildAdversarialFixture({ failedCase: 'fake gate' });
  return [
    test('v130_adversarial_fixture_pass', () => pass.status === 'pass' && pass.results.length >= 8),
    test('v130_adversarial_fixture_fail_closed', () => fail.status === 'fail' && fail.reasonCodes.includes('v130_adversarial_fixture_failed')),
  ];
}

function compatibilityTests() {
  const source = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const legacySuites = source.legacySelfTestSuites || {};
  const versionAuthority = source.versionAuthority || {};
  const currentActiveV129 = source.activeHarnessVersion === '1.2.9'
    && source.activeSelfTestSuite === 'v129'
    && (versionAuthority.v129 === 'blocking_current_active_authority' || legacySuites.v129 === 'blocking_current_active_authority');
  const futureActiveV130 = source.activeHarnessVersion === '1.3.0'
    && source.activeSelfTestSuite === 'v130'
    && versionAuthority.v130 === 'blocking_current_active_authority';
  return [
    test('v130_v129_current_or_immediate_rollback_contract', () => (currentActiveV129 || (futureActiveV130 && versionAuthority.v129 === 'immediate_rollback')) && fs.existsSync('scripts/codex-v129-self-test.mjs')),
    test('v130_v128_blocking_compatibility_contract', () => ['blocking_compatibility', 'blocking_compatibility_rollback'].includes(versionAuthority.v128 || legacySuites.v128) && fs.existsSync('scripts/codex-v128-self-test.mjs')),
    test('v130_v127_readable_compatibility_contract', () => ['blocking_compatibility', 'compatibility_readable'].includes(versionAuthority.v127 || legacySuites.v127) && fs.existsSync('scripts/codex-v127-self-test.mjs')),
    test('v130_compatibility_does_not_create_authority', () => source.finalAuthority === 'v1.1.8_final_decision_kernel' && source.authorityCreated !== true),
  ];
}

function selectedStages() {
  const arg = process.argv.find((item) => item.startsWith('--stage='));
  if (!arg) return new Set(['contracts']);
  const stage = arg.split('=')[1];
  if (stage === 'all') return new Set(['contracts', 'intake-context', 'orchestration-autonomy', 'token-differential', 'adversarial-benchmark']);
  return new Set(stage.split(',').map((item) => item.trim()).filter(Boolean));
}

const stages = selectedStages();
const cases = [
  ...(stages.has('contracts') || stages.has('contract') ? contractTests() : []),
  ...(stages.has('intake-context') || stages.has('intake') || stages.has('context') ? intakeContextTests() : []),
  ...(stages.has('orchestration-autonomy') || stages.has('orchestration') || stages.has('autonomy') ? orchestrationAutonomyTests() : []),
  ...(stages.has('token-differential') || stages.has('benchmark') ? tokenDifferentialTests() : []),
  ...(stages.has('adversarial-benchmark') || stages.has('adversarial') ? adversarialBenchmarkTests() : []),
  ...(stages.has('v129-compatibility') || stages.has('v128-compatibility') || stages.has('v127-compatibility') || stages.has('compatibility') ? compatibilityTests() : []),
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
