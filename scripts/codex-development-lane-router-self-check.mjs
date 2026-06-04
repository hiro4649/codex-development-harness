#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import assert from 'node:assert/strict';
import {
  buildDevelopmentLaneSafeSummary,
  classifyDevelopmentLane,
} from './codex-development-lane-router.mjs';

const docsProcess = ['docs/process/CODEX_DEVELOPMENT_LANE_SEPARATION_POLICY_V1_0_6.json'];

function base(overrides = {}) {
  return {
    lane: 'docs_only_planning',
    changed_files: docsProcess,
    is_draft: true,
    explicit_user_scope_change: true,
    runtime_readiness_claimed: false,
    production_readiness_claimed: false,
    real_tts_readiness_claimed: false,
    merge_readiness_claimed: false,
    ...overrides,
  };
}

function expectStatus(name, input, status, allowed, blocked, reasonCode) {
  const result = classifyDevelopmentLane(input);
  assert.equal(result.status, status, name);
  assert.equal(result.allowed, allowed, `${name}: allowed`);
  assert.equal(result.blocked, blocked, `${name}: blocked`);
  assert.equal(result.safe_summary_only, true, `${name}: safe summary`);
  if (reasonCode) assert.ok(result.reason_codes.includes(reasonCode), `${name}: missing ${reasonCode}`);
  return result;
}

const records = [
  expectStatus('docs only planning allowed', base(), 'allowed', true, false),
  expectStatus('docs only planning src blocked', base({ changed_files: ['src/runtime.ts'], touches_src: true }), 'blocked', false, true, 'src_touch_blocked'),
  expectStatus('spec persistence allowed', base({ lane: 'spec_persistence', explicit_user_scope_change: false }), 'allowed', true, false),
  expectStatus('roadmap recovery allowed', base({ lane: 'roadmap_recovery', explicit_user_scope_change: false }), 'allowed', true, false),
  expectStatus('common utility planning allowed', base({ lane: 'common_utility_planning', explicit_user_scope_change: false }), 'allowed', true, false),
  expectStatus('merge lane blocked', base({ lane: 'merge' }), 'blocked', false, true, 'merge_lane_blocked'),
  expectStatus('runtime lane blocked', base({ lane: 'runtime' }), 'blocked', false, true, 'runtime_lane_blocked'),
  expectStatus('existing pr preserve only', base({ lane: 'existing_pr' }), 'preserve_only', false, false, 'existing_pr_preserve_only'),
  expectStatus('schema validator blocked by default', base({ lane: 'new_schema_validator' }), 'blocked_by_default', false, true, 'lane_not_allowed'),
  expectStatus('runtime integration blocked', base({ lane: 'new_runtime_integration' }), 'blocked', false, true, 'runtime_lane_blocked'),
  expectStatus('product implementation blocked by default', base({ lane: 'new_product_implementation' }), 'blocked_by_default', false, true, 'lane_not_allowed'),
  expectStatus('review governance read only', base({ lane: 'review_governance' }), 'read_only_monitoring', true, false),
  expectStatus('state monitoring without delta blocked', base({ lane: 'state_change_monitoring', state_delta_detected: false }), 'blocked_repeated_monitoring', false, true, 'state_delta_required_for_monitoring'),
  expectStatus('state monitoring with delta allowed', base({ lane: 'state_change_monitoring', state_delta_detected: true }), 'allowed_monitoring', true, false),
  expectStatus('runtime readiness claim blocked', base({ runtime_readiness_claimed: true }), 'blocked', false, true, 'runtime_readiness_claim_blocked'),
  expectStatus('production readiness claim blocked', base({ production_readiness_claimed: true }), 'blocked', false, true, 'production_readiness_claim_blocked'),
  expectStatus('real tts readiness claim blocked', base({ real_tts_readiness_claimed: true }), 'blocked', false, true, 'real_tts_readiness_claim_blocked'),
  expectStatus('merge readiness claim blocked', base({ merge_readiness_claimed: true }), 'blocked', false, true, 'merge_readiness_claim_blocked'),
  expectStatus('MisoTTS call blocked', base({ calls_miso_tts: true }), 'blocked', false, true, 'miso_tts_call_blocked'),
  expectStatus('MOSS-TTS call blocked', base({ calls_moss_tts: true }), 'blocked', false, true, 'moss_tts_call_blocked'),
  expectStatus('Irodori-TTS call blocked', base({ calls_irodori_tts: true }), 'blocked', false, true, 'irodori_tts_call_blocked'),
  expectStatus('Live2D renderer call blocked', base({ calls_live2d_renderer: true }), 'blocked', false, true, 'live2d_renderer_call_blocked'),
  expectStatus('model download blocked', base({ downloads_model: true }), 'blocked', false, true, 'model_download_blocked'),
  expectStatus('API call blocked', base({ performs_api_call: true }), 'blocked', false, true, 'api_call_blocked'),
  expectStatus('endpoint config blocked', base({ adds_endpoint_config: true }), 'blocked', false, true, 'endpoint_config_blocked'),
  expectStatus('benchmark execution blocked', base({ runs_benchmark: true }), 'blocked', false, true, 'benchmark_execution_blocked'),
  expectStatus('quality gate weakening blocked', base({ weakens_quality_gate: true }), 'blocked', false, true, 'quality_gate_weakening_blocked'),
  expectStatus('review independence weakening blocked', base({ weakens_review_independence: true }), 'blocked', false, true, 'review_independence_weakening_blocked'),
  expectStatus('writer self review pass blocked', base({ treats_writer_self_review_as_pass: true }), 'blocked', false, true, 'writer_self_review_pass_blocked'),
];

const summary = buildDevelopmentLaneSafeSummary([
  ...records,
  base({ changed_files: ['endpoint/config.json'], token: 'SECRET_SHOULD_NOT_APPEAR' }),
]);

const serialized = JSON.stringify(summary);
for (const forbidden of [
  'changed_files',
  'endpoint/config.json',
  'API key',
  'token',
  'secret',
  'model path',
  'dataset path',
  'raw payload',
  'SECRET_SHOULD_NOT_APPEAR',
]) {
  assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, `safe summary leaked ${forbidden}`);
}

assert.equal(summary.safe_summary_only, true, 'summary safe flag');
assert.equal(summary.record_count, records.length + 1, 'summary count');
assert.ok(summary.allowed_count >= 5, 'summary allowed count');
assert.ok(summary.blocked_count >= 20, 'summary blocked count');

console.log('developmentLaneRouterSelfCheckStatus: pass');
