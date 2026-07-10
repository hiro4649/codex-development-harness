#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson, sha256, V132_FINAL_AUTHORITY, V132_VERSION } from './codex-v132-evidence-truth.mjs';

const WHITESPACE = /\s/;

export const V132_CANDIDATE_LIFECYCLE_STATES = Object.freeze([
  'draft',
  'local_validated',
  'remote_unavailable',
  'remote_validated',
  'activation_eligible',
  'active',
  'superseded',
]);

export function validateCandidateLifecycleTransition(fromState, toState, policy = {}) {
  const configuredStates = policy.candidateLifecycle?.states || [];
  const transitions = policy.candidateLifecycle?.allowedTransitions || {};
  const reasons = [];
  if (!V132_CANDIDATE_LIFECYCLE_STATES.includes(fromState) || !configuredStates.includes(fromState)) reasons.push('candidate_lifecycle_from_invalid');
  if (!V132_CANDIDATE_LIFECYCLE_STATES.includes(toState) || !configuredStates.includes(toState)) reasons.push('candidate_lifecycle_to_invalid');
  if (!(transitions[fromState] || []).includes(toState)) reasons.push('candidate_lifecycle_transition_forbidden');
  if (toState === 'active' && policy.activationAllowed !== true) reasons.push('candidate_activation_not_allowed');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, authorityCreated: false };
}

export function deriveCandidateLifecycleState({ localValidationState, remoteValidationState, technicalMergeEligibility, finalDecisionState, active = false, superseded = false } = {}) {
  if (superseded) return 'superseded';
  if (active) return 'active';
  if (localValidationState !== 'passed') return 'draft';
  if (['unavailable_billing', 'unavailable_pre_runner'].includes(remoteValidationState)) return 'remote_unavailable';
  if (remoteValidationState !== 'passed') return 'local_validated';
  if (technicalMergeEligibility === 'eligible' && finalDecisionState === 'authorized') return 'activation_eligible';
  return 'remote_validated';
}

class StrictJsonScanner {
  constructor(text) {
    this.text = String(text);
    this.index = 0;
    this.collisions = [];
  }

  scan() {
    this.skipWhitespace();
    this.parseValue('$');
    this.skipWhitespace();
    if (this.index !== this.text.length) throw new Error(`json_trailing_data:${this.index}`);
    if (this.collisions.length) throw new Error(this.collisions.join(','));
  }

  skipWhitespace() {
    while (this.index < this.text.length && WHITESPACE.test(this.text[this.index])) this.index += 1;
  }

  parseValue(pathName) {
    this.skipWhitespace();
    const char = this.text[this.index];
    if (char === '{') return this.parseObject(pathName);
    if (char === '[') return this.parseArray(pathName);
    if (char === '"') return this.parseStringToken().value;
    if (char === '-' || /[0-9]/.test(char || '')) return this.parseNumber();
    for (const literal of ['true', 'false', 'null']) {
      if (this.text.startsWith(literal, this.index)) {
        this.index += literal.length;
        return literal === 'true' ? true : literal === 'false' ? false : null;
      }
    }
    throw new Error(`json_value_invalid:${pathName}:${this.index}`);
  }

  parseObject(pathName) {
    const result = {};
    const exactKeys = new Map();
    const foldedKeys = new Map();
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === '}') {
      this.index += 1;
      return result;
    }
    while (this.index < this.text.length) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') throw new Error(`json_object_key_missing:${pathName}:${this.index}`);
      const token = this.parseStringToken();
      const normalized = token.value.normalize('NFC');
      const folded = normalized.toLocaleLowerCase('en-US');
      if (exactKeys.has(normalized)) {
        const previousRaw = exactKeys.get(normalized);
        const kind = previousRaw === token.raw ? 'exact_duplicate_key' : 'escaped_equivalent_duplicate_key';
        this.collisions.push(`${kind}:${pathName}.${normalized}`);
      } else {
        exactKeys.set(normalized, token.raw);
      }
      if (foldedKeys.has(folded) && foldedKeys.get(folded) !== normalized) {
        this.collisions.push(`case_fold_duplicate_key:${pathName}.${normalized}`);
      } else {
        foldedKeys.set(folded, normalized);
      }
      this.skipWhitespace();
      if (this.text[this.index] !== ':') throw new Error(`json_object_colon_missing:${pathName}.${normalized}:${this.index}`);
      this.index += 1;
      result[normalized] = this.parseValue(`${pathName}.${normalized}`);
      this.skipWhitespace();
      if (this.text[this.index] === '}') {
        this.index += 1;
        return result;
      }
      if (this.text[this.index] !== ',') throw new Error(`json_object_separator_invalid:${pathName}:${this.index}`);
      this.index += 1;
    }
    throw new Error(`json_object_unterminated:${pathName}`);
  }

  parseArray(pathName) {
    const result = [];
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === ']') {
      this.index += 1;
      return result;
    }
    while (this.index < this.text.length) {
      result.push(this.parseValue(`${pathName}[${result.length}]`));
      this.skipWhitespace();
      if (this.text[this.index] === ']') {
        this.index += 1;
        return result;
      }
      if (this.text[this.index] !== ',') throw new Error(`json_array_separator_invalid:${pathName}:${this.index}`);
      this.index += 1;
    }
    throw new Error(`json_array_unterminated:${pathName}`);
  }

  parseStringToken() {
    const start = this.index;
    this.index += 1;
    let escaping = false;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        this.index += 1;
        const raw = this.text.slice(start, this.index);
        return { raw, value: JSON.parse(raw) };
      } else if (char.charCodeAt(0) < 0x20) {
        throw new Error(`json_string_control_character:${this.index}`);
      }
      this.index += 1;
    }
    throw new Error(`json_string_unterminated:${start}`);
  }

  parseNumber() {
    const match = this.text.slice(this.index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) throw new Error(`json_number_invalid:${this.index}`);
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) throw new Error(`json_number_non_finite:${this.index}`);
    return value;
  }
}

export function parseJsonStrict(text) {
  const scanner = new StrictJsonScanner(text);
  scanner.scan();
  return JSON.parse(String(text));
}

export function readJsonStrict(file) {
  return parseJsonStrict(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

export function validateStaticRegistry(registry = []) {
  const reasons = [];
  const repositories = new Set();
  const repositoryIds = new Set();
  if (!Array.isArray(registry) || registry.length !== 8) reasons.push('static_registry_must_classify_eight_repositories');
  for (const [index, entry] of (registry || []).entries()) {
    const prefix = `registry_${index}`;
    if (!/^hiro4649\/[A-Za-z0-9_.-]+$/.test(String(entry.repositoryFullName || ''))) reasons.push(`${prefix}_repository_invalid`);
    if (!Number.isInteger(entry.repositoryId) || entry.repositoryId < 1) reasons.push(`${prefix}_repository_id_invalid`);
    if (!['source', 'target'].includes(entry.role)) reasons.push(`${prefix}_role_invalid`);
    if (!['registered', 'explicitly_excluded', 'unclassified_blocking'].includes(entry.registrationState)) reasons.push(`${prefix}_registration_state_invalid`);
    if (!entry.profileClass) reasons.push(`${prefix}_profile_missing`);
    if (entry.defaultBranch !== 'main') reasons.push(`${prefix}_default_branch_invalid`);
    if (entry.desiredNextHarnessVersion !== V132_VERSION) reasons.push(`${prefix}_desired_version_invalid`);
    if (entry.classificationSource !== 'owner_spec') reasons.push(`${prefix}_classification_source_invalid`);
    if (repositories.has(String(entry.repositoryFullName).toLowerCase())) reasons.push(`${prefix}_repository_duplicate`);
    if (repositoryIds.has(entry.repositoryId)) reasons.push(`${prefix}_repository_id_duplicate`);
    repositories.add(String(entry.repositoryFullName).toLowerCase());
    repositoryIds.add(entry.repositoryId);
  }
  const aps = (registry || []).find((entry) => entry.repositoryFullName === 'hiro4649/APS-GATE');
  if (aps?.profileClass !== 'lite_action_target') reasons.push('aps_gate_lite_action_profile_missing');
  return { status: reasons.length ? 'fail' : 'pass', classifiedRepositoryCount: repositories.size, reasonCodes: reasons, createsAuthority: false };
}

export function compileEffectivePolicy(policy = {}) {
  const tuple = policy.intendedSourceTuple || {};
  const registryStatus = validateStaticRegistry(policy.staticRegistry || []);
  const compact = {
    schemaVersion: V132_VERSION,
    marker: `CODEX_QUALITY_HARNESS_FILE v${V132_VERSION}`,
    name: policy.name,
    acceptedMainVersion: policy.acceptedMainVersion,
    acceptedMainSha: policy.acceptedMainSha,
    acceptedMainShaRole: policy.acceptedMainShaRole,
    acceptedMainShaCreatesTrustAuthority: policy.acceptedMainShaCreatesTrustAuthority === true,
    developmentParentVersion: policy.developmentParentVersion,
    candidateVersion: policy.candidateVersion,
    executionHarnessVersion: policy.executionHarnessVersion,
    candidateLifecycleState: policy.candidateLifecycleState,
    provisionalBaseSha: policy.provisionalBaseSha,
    requiresRebaseAfterV131Merge: policy.requiresRebaseAfterV131Merge === true,
    activationAllowed: policy.activationAllowed === true,
    targetRolloutAllowed: policy.targetRolloutAllowed === true,
    remoteValidationState: policy.remoteValidationState,
    activeHarnessVersion: tuple.activeHarnessVersion,
    activeHarnessVersionAliasState: policy.versionSemantics?.activeHarnessVersion,
    activeHarnessVersionAuthority: policy.versionSemantics?.activeHarnessVersionCreatesPublishedAuthority,
    activeSelfTestSuite: tuple.activeSelfTestSuite,
    activeSelfTestStatusKey: tuple.activeSelfTestStatusKey,
    previousVersion: tuple.previousVersion,
    finalAuthority: tuple.finalAuthority,
    authorityCreated: tuple.authorityCreated,
    targetRolloutState: tuple.targetRolloutState,
    targetMutationCount: tuple.targetMutationCount,
    performanceTrack: policy.performanceTrack,
    routineRequiredReads: policy.routineReadContract?.requiredReads || [],
    fullManifestDeferredTo: policy.routineReadContract?.fullManifestDeferredTo || [],
    registryDigest: sha256(canonicalJson(policy.staticRegistry || [])),
    registryCount: registryStatus.classifiedRepositoryCount,
    policyDigest: sha256(canonicalJson(policy)),
  };
  return compact;
}

export function compileManifestProjection(policy = {}) {
  const effectivePolicy = compileEffectivePolicy(policy);
  return {
    marker: effectivePolicy.marker,
    schemaVersion: V132_VERSION,
    harnessVersion: V132_VERSION,
    sourceHarnessVersion: V132_VERSION,
    acceptedMainVersion: policy.acceptedMainVersion,
    acceptedMainSha: policy.acceptedMainSha,
    acceptedMainShaRole: policy.acceptedMainShaRole,
    acceptedMainShaCreatesTrustAuthority: policy.acceptedMainShaCreatesTrustAuthority === true,
    developmentParentVersion: policy.developmentParentVersion,
    candidateVersion: policy.candidateVersion,
    executionHarnessVersion: policy.executionHarnessVersion,
    candidateLifecycleState: policy.candidateLifecycleState,
    activeHarnessVersion: V132_VERSION,
    activeHarnessVersionAliasState: policy.versionSemantics?.activeHarnessVersion,
    activeHarnessVersionAuthority: policy.versionSemantics?.activeHarnessVersionCreatesPublishedAuthority,
    acceptedMainVersionAuthority: policy.versionSemantics?.acceptedMainVersion,
    candidateVersionAuthority: policy.versionSemantics?.candidateVersion,
    activeSelfTestSuite: 'v132',
    activeSelfTestStatusKey: 'v132SelfTestStatus',
    currentVersion: V132_VERSION,
    previousVersion: '1.3.1',
    candidateHarnessVersion: V132_VERSION,
    candidateSelfTestSuite: 'v132',
    candidateSelfTestStatusKey: 'v132SelfTestStatus',
    candidateActivationState: 'local_source_candidate',
    sourceActivation: 'forbidden_until_v131_main_and_exact_head_remote_pass',
    provisionalBaseSha: policy.provisionalBaseSha,
    requiresRebaseAfterV131Merge: true,
    activationAllowed: false,
    targetRolloutAllowed: false,
    remoteValidationState: 'not_observed',
    sourceCandidateDisplay: policy.sourceCandidateDisplay,
    targetInstalledState: policy.targetInstalledState,
    targetRolloutState: policy.targetRolloutState,
    finalAuthority: V132_FINAL_AUTHORITY,
    authorityCreated: false,
    targetMutationCount: 0,
    canonicalPolicySource: 'docs/process/CODEX_V132_POLICY.json',
    canonicalPolicyDigest: effectivePolicy.policyDigest,
    compiledEffectivePolicyDigest: sha256(canonicalJson(effectivePolicy)),
  };
}

const V132_CANONICAL_VERSION_AUTHORITY = Object.freeze({
  v132: 'local_source_candidate',
  v131: 'immediate_rollback',
  v130: 'secondary_rollback',
  v129: 'emergency_legacy_rollback',
  v128: 'blocking_compatibility',
  v127: 'readable_compatibility',
});

function validateDeepActiveSemantics(value, pathName, reasons, inheritedHistorical = false) {
  if (!value || typeof value !== 'object') return;
  const historical = inheritedHistorical || (String(value.authorityScope || '').startsWith('historical_') && value.activeForV132 === false);
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathName}.${key}`;
    if (!historical && ['activeHarnessVersion', 'currentVersion', 'candidateHarnessVersion'].includes(key)
      && child !== V132_VERSION) reasons.push(`stale_active_version:${childPath}:${child}`);
    if (!historical && key === 'sourceActivation' && child !== 'forbidden_until_v131_main_and_exact_head_remote_pass') {
      reasons.push(`stale_source_activation:${childPath}:${child}`);
    }
    if (!historical && key === 'activationReady' && child === true) reasons.push(`stale_activation_ready_true:${childPath}`);
    if (!historical && key === 'targetHarnessVersion') reasons.push(`global_target_harness_version_forbidden:${childPath}`);
    if (!historical && ['installedTargetHarnessVersion', 'operatorTargetHarnessDisplay', 'sourceCoreTargetRolloutState'].includes(key)) {
      reasons.push(`ambiguous_target_display_field_forbidden:${childPath}`);
    }
    if (!historical && key === 'theme' && /v1\.3\.0|Goal-Contracted|Operational Convergence/i.test(String(child))) {
      reasons.push(`stale_active_theme:${childPath}`);
    }
    if (!historical && key === 'versionAuthority' && child && typeof child === 'object') {
      for (const [version, role] of Object.entries(V132_CANONICAL_VERSION_AUTHORITY)) {
        if (child[version] !== role) reasons.push(`rollback_role_mismatch:${childPath}.${version}`);
      }
    }
    if (!historical && ['legacySelfTests', 'legacySelfTestSuites'].includes(key) && child && typeof child === 'object') {
      for (const [version, role] of Object.entries(V132_CANONICAL_VERSION_AUTHORITY).filter(([version]) => version !== 'v132')) {
        if (child[version] !== role) reasons.push(`legacy_role_mismatch:${childPath}.${version}`);
      }
    }
    validateDeepActiveSemantics(child, childPath, reasons, historical);
  }
}

export function validateManifestSemanticConvergence(manifest, label = 'manifest') {
  const reasons = [];
  validateDeepActiveSemantics(manifest, label, reasons);
  if (manifest.sourceCandidateDisplay !== 'HARNESS v1.3.2 Evidence-Converged Lean Core') reasons.push(`${label}_source_candidate_display_invalid`);
  if (manifest.targetInstalledState !== 'per_repository_dynamic_observation') reasons.push(`${label}_target_installed_state_invalid`);
  if (manifest.targetRolloutState !== 'not_started') reasons.push(`${label}_target_rollout_state_invalid`);
  if (manifest.acceptedMainVersion !== '1.3.0') reasons.push(`${label}_accepted_main_version_invalid`);
  if (manifest.developmentParentVersion !== '1.3.1') reasons.push(`${label}_development_parent_version_invalid`);
  if (manifest.candidateVersion !== V132_VERSION || manifest.executionHarnessVersion !== V132_VERSION) reasons.push(`${label}_candidate_execution_version_invalid`);
  if (!V132_CANDIDATE_LIFECYCLE_STATES.includes(manifest.candidateLifecycleState)) reasons.push(`${label}_candidate_lifecycle_state_invalid`);
  if (manifest.activeHarnessVersionAliasState !== 'deprecated_execution_compatibility_alias' || manifest.activeHarnessVersionAuthority !== false) {
    reasons.push(`${label}_active_harness_alias_not_deprecated`);
  }
  if (manifest.acceptedMainVersionAuthority !== 'published_authority_version') reasons.push(`${label}_accepted_main_authority_invalid`);
  if (manifest.candidateVersionAuthority !== 'unmerged_candidate_version') reasons.push(`${label}_candidate_version_authority_invalid`);
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: [...new Set(reasons)], authority: false };
}

export function validateManifestProjections({ policy = {}, sourceManifest = {}, docsManifest = {}, activePolicy = {} } = {}) {
  const expected = compileManifestProjection(policy);
  const reasons = [];
  for (const [label, manifest] of [['source', sourceManifest], ['docs', docsManifest], ['active_policy', activePolicy]]) {
    for (const [key, value] of Object.entries(expected)) {
      if (manifest[key] !== value) reasons.push(`${label}_${key}_projection_mismatch`);
    }
    const semantic = validateManifestSemanticConvergence(manifest, label);
    if (semantic.status !== 'pass') reasons.push(...semantic.reasonCodes);
  }
  if ((sourceManifest.registeredTargetRepositories || []).some((entry) => Object.hasOwn(entry, 'currentTargetHarnessVersion'))) {
    reasons.push('ambiguous_current_target_harness_version_forbidden');
  }
  const registryStatus = validateStaticRegistry(sourceManifest.staticRepositoryRegistryV2 || []);
  if (registryStatus.status !== 'pass') reasons.push(...registryStatus.reasonCodes);
  if (sourceManifest.dynamicRepositoryObservation?.persistedInStaticManifest !== false) reasons.push('dynamic_observation_must_be_separate');
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    expectedProjectionDigest: sha256(canonicalJson(expected)),
    registryStatus,
    createsAuthority: false,
  };
}

export function loadV132Policy(repoRoot = process.cwd()) {
  return readJsonStrict(path.join(repoRoot, 'docs', 'process', 'CODEX_V132_POLICY.json'));
}

function writeAtomic(file, text) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, text, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, file);
}

export function writeManifestProjections(repoRoot = process.cwd()) {
  const root = path.resolve(repoRoot);
  const policy = loadV132Policy(root);
  const projection = compileManifestProjection(policy);
  const manifestFiles = [
    'CODEX_SOURCE_HARNESS_MANIFEST.json',
    'docs/process/CODEX_HARNESS_MANIFEST.json',
    'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
  ];
  for (const relative of manifestFiles) {
    const file = path.join(root, relative);
    const current = readJsonStrict(file);
    writeAtomic(file, `${JSON.stringify({ ...current, ...projection }, null, 2)}\n`);
  }
  const compact = compileEffectivePolicy(policy);
  const compactText = `${canonicalJson(compact)}\n`;
  if (Buffer.byteLength(compactText, 'utf8') > Number(policy.routineReadContract?.compactEffectivePolicyBytesMax || 2048)) {
    throw new Error('compact_effective_policy_byte_limit_exceeded');
  }
  const compactPath = path.join(root, 'docs/process/CODEX_EFFECTIVE_POLICY.compact.json');
  writeAtomic(compactPath, compactText);
  return {
    manifestFiles,
    compactPath: 'docs/process/CODEX_EFFECTIVE_POLICY.compact.json',
    compactBytes: Buffer.byteLength(compactText, 'utf8'),
    projectionDigest: sha256(canonicalJson(projection)),
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const policy = loadV132Policy();
  if (process.argv.includes('--write')) console.log(JSON.stringify(writeManifestProjections(), null, 2));
  else console.log(JSON.stringify(compileEffectivePolicy(policy), null, 2));
}
