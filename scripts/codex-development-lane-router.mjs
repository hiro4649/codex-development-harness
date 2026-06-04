#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5

const laneBehaviors = new Map([
  ['merge', { status: 'blocked', reasonCode: 'merge_lane_blocked', safeNextAction: 'keep_merge_lane_blocked' }],
  ['runtime', { status: 'blocked', reasonCode: 'runtime_lane_blocked', safeNextAction: 'keep_runtime_lane_blocked' }],
  ['existing_pr', { status: 'preserve_only', reasonCode: 'existing_pr_preserve_only', safeNextAction: 'preserve_existing_pr_state_only' }],
  ['docs_only_planning', { status: 'allowed', safeNextAction: 'continue_docs_process_planning_only' }],
  ['spec_persistence', { status: 'allowed', safeNextAction: 'persist_spec_in_docs_process_only' }],
  ['roadmap_recovery', { status: 'allowed', safeNextAction: 'record_roadmap_recovery_in_docs_process_only' }],
  ['common_utility_planning', { status: 'allowed', safeNextAction: 'plan_common_utility_in_docs_process_only' }],
  ['new_schema_validator', { status: 'blocked_by_default', reasonCode: 'lane_not_allowed', safeNextAction: 'split_schema_validator_for_explicit_approval' }],
  ['new_runtime_integration', { status: 'blocked', reasonCode: 'runtime_lane_blocked', safeNextAction: 'do_not_connect_runtime_integration' }],
  ['new_product_implementation', { status: 'blocked_by_default', reasonCode: 'lane_not_allowed', safeNextAction: 'split_product_implementation_for_explicit_approval' }],
  ['review_governance', { status: 'read_only_monitoring', safeNextAction: 'continue_read_only_review_governance' }],
  ['state_change_monitoring', { status: 'state_monitoring', safeNextAction: 'monitor_only_when_state_delta_exists' }],
]);

const blockedBooleanFields = [
  ['runtime_readiness_claimed', 'runtime_readiness_claim_blocked'],
  ['production_readiness_claimed', 'production_readiness_claim_blocked'],
  ['real_tts_readiness_claimed', 'real_tts_readiness_claim_blocked'],
  ['merge_readiness_claimed', 'merge_readiness_claim_blocked'],
  ['touches_existing_preserve_pr', 'existing_preserve_pr_touch_blocked'],
  ['touches_runtime', 'runtime_touch_blocked'],
  ['touches_src', 'src_touch_blocked'],
  ['touches_test', 'test_touch_blocked'],
  ['touches_github_workflow', 'workflow_touch_blocked'],
  ['touches_package', 'package_touch_blocked'],
  ['calls_tts_engine', 'tts_engine_call_blocked'],
  ['calls_moss_tts', 'moss_tts_call_blocked'],
  ['calls_miso_tts', 'miso_tts_call_blocked'],
  ['calls_irodori_tts', 'irodori_tts_call_blocked'],
  ['calls_live2d_renderer', 'live2d_renderer_call_blocked'],
  ['downloads_model', 'model_download_blocked'],
  ['performs_api_call', 'api_call_blocked'],
  ['adds_endpoint_config', 'endpoint_config_blocked'],
  ['runs_benchmark', 'benchmark_execution_blocked'],
  ['weakens_quality_gate', 'quality_gate_weakening_blocked'],
  ['weakens_review_independence', 'review_independence_weakening_blocked'],
  ['treats_writer_self_review_as_pass', 'writer_self_review_pass_blocked'],
];

const docsOnlyLanes = new Set([
  'docs_only_planning',
  'spec_persistence',
  'roadmap_recovery',
  'common_utility_planning',
]);

const allowedHarnessScriptFiles = new Set([
  'scripts/codex-development-lane-router.mjs',
  'scripts/codex-development-lane-router-self-check.mjs',
]);

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function changedFiles(input) {
  return Array.isArray(input?.changed_files) ? input.changed_files.map(normalizePath).filter(Boolean) : [];
}

function isDocsProcessOnly(files) {
  return files.length > 0 && files.every((file) => file.startsWith('docs/process/'));
}

function onlyAllowedRouterImplementationFiles(files) {
  return files.length > 0 && files.every((file) => allowedHarnessScriptFiles.has(file) || file.startsWith('docs/process/'));
}

function addReason(reasons, code) {
  if (code && !reasons.includes(code)) reasons.push(code);
}

function baseResult(lane, status, allowed, blocked, reasonCodes, safeNextAction) {
  return {
    status,
    lane,
    allowed,
    blocked,
    reason_codes: reasonCodes,
    safe_next_action: safeNextAction,
    safe_summary_only: true,
  };
}

export function classifyDevelopmentLane(input = {}) {
  const lane = String(input.lane || '').trim();
  const behavior = laneBehaviors.get(lane);
  const files = changedFiles(input);
  const reasonCodes = [];

  if (!behavior) {
    addReason(reasonCodes, 'lane_not_allowed');
    return baseResult(lane || 'unknown', 'blocked', false, true, reasonCodes, 'choose_supported_development_lane');
  }

  for (const [field, code] of blockedBooleanFields) {
    if (input[field] === true) addReason(reasonCodes, code);
  }

  if (input.touches_scripts === true && !onlyAllowedRouterImplementationFiles(files)) {
    addReason(reasonCodes, 'lane_not_allowed');
  }

  if (input.touches_readme === true) addReason(reasonCodes, 'docs_only_scope_required');

  if (lane === 'state_change_monitoring') {
    if (input.state_delta_detected === true) {
      return baseResult(lane, 'allowed_monitoring', true, false, reasonCodes, 'continue_state_delta_monitoring_only');
    }
    addReason(reasonCodes, 'state_delta_required_for_monitoring');
    return baseResult(lane, 'blocked_repeated_monitoring', false, true, reasonCodes, 'stop_repeated_monitoring_until_state_delta_exists');
  }

  if (lane === 'existing_pr') {
    return baseResult(lane, 'preserve_only', false, false, reasonCodes.length ? reasonCodes : ['existing_pr_preserve_only'], 'preserve_existing_pr_state_only');
  }

  if (lane === 'review_governance') {
    return baseResult(lane, 'read_only_monitoring', true, false, reasonCodes, 'continue_read_only_review_governance');
  }

  if (docsOnlyLanes.has(lane)) {
    if (input.is_draft !== true) addReason(reasonCodes, 'draft_required');
    if (!isDocsProcessOnly(files)) addReason(reasonCodes, 'docs_only_scope_required');
    if (lane === 'docs_only_planning' && input.explicit_user_scope_change !== true) {
      addReason(reasonCodes, 'explicit_scope_required');
    }
    const blocked = reasonCodes.length > 0;
    return baseResult(lane, blocked ? 'blocked' : 'allowed', !blocked, blocked, reasonCodes, blocked ? 'restore_docs_process_draft_scope' : behavior.safeNextAction);
  }

  if (behavior.status === 'blocked' || behavior.status === 'blocked_by_default') {
    addReason(reasonCodes, behavior.reasonCode);
    return baseResult(lane, behavior.status, false, true, reasonCodes, behavior.safeNextAction);
  }

  const blocked = reasonCodes.length > 0;
  return baseResult(lane, blocked ? 'blocked' : behavior.status, !blocked, blocked, reasonCodes, blocked ? 'clear_blocked_conditions_before_continuing' : behavior.safeNextAction);
}

export function buildDevelopmentLaneSafeSummary(records = []) {
  const classified = records.map((record) => record?.safe_summary_only ? record : classifyDevelopmentLane(record));
  return {
    record_count: classified.length,
    allowed_count: classified.filter((record) => record.allowed === true).length,
    blocked_count: classified.filter((record) => record.blocked === true).length,
    docs_only_allowed_count: classified.filter((record) => docsOnlyLanes.has(record.lane) && record.allowed === true).length,
    preserve_only_count: classified.filter((record) => record.status === 'preserve_only').length,
    runtime_blocked_count: classified.filter((record) => record.reason_codes?.includes('runtime_lane_blocked') || record.reason_codes?.includes('runtime_touch_blocked')).length,
    merge_blocked_count: classified.filter((record) => record.reason_codes?.includes('merge_lane_blocked') || record.reason_codes?.includes('merge_readiness_claim_blocked')).length,
    state_delta_required_count: classified.filter((record) => record.reason_codes?.includes('state_delta_required_for_monitoring')).length,
    safe_summary_only: true,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const input = process.env.CODEX_DEVELOPMENT_LANE_INPUT_JSON ? JSON.parse(process.env.CODEX_DEVELOPMENT_LANE_INPUT_JSON) : {};
  console.log(JSON.stringify(classifyDevelopmentLane(input), null, 2));
}
