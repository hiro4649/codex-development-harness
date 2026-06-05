#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildPromptGovernanceReport, buildPromptEvalSuiteReport } from './codex-prompt-governance-gate.mjs';
import { buildReviewEvalSuiteReport } from './codex-review-eval-suite.mjs';
import { buildPromptVariantSuggestionReport } from './codex-prompt-variant-suggest.mjs';
import { buildKnowledgeGovernanceReport } from './codex-knowledge-governance-gate.mjs';
import { buildContractGovernanceReport } from './codex-contract-governance-gate.mjs';
import { buildHumanConfirmationObjectReport } from './codex-human-confirmation-validate.mjs';
import { buildEvidencePackReport } from './codex-evidence-pack-validate.mjs';

function assertCase(name, ok, failures, cases, detail = '') {
  cases.push({ name, status: ok ? 'pass' : 'fail', detail: String(detail || '').slice(0, 120), safeSummaryOnly: true });
  if (!ok) failures.push(name);
}

function tempJson(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v087-'));
  const file = path.join(dir, 'fixture.json');
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

function baseEnv(overrides = {}) {
  return {
    CODEX_QUALITY_REPORT: 'json',
    CODEX_EVENT_NAME: '',
    CODEX_PR_BODY: '',
    CODEX_CHANGED_FILES: 'README.md',
    CODEX_DIFF_NUMSTAT: '0\t0\tREADME.md',
    ...overrides,
  };
}

function prEnv(overrides = {}) {
  return baseEnv({ CODEX_EVENT_NAME: 'pull_request', CODEX_PR_NUMBER: '1', CODEX_PR_HEAD_SHA: 'abc123', ...overrides });
}

function sourcePrBody() {
  return `PR profile: harness_workflow_r3
Risk level: R3

## Goal
Upgrade Codex Development Harness source to v0.8.7.

## Task Mode
Task mode: harness_change

## Code Review Monitor
Review surface: source harness managed files
Risk summary: no product runtime code changed
Test or verification evidence: v087 self-test, prompt eval suite, review eval suite, knowledge governance gate, contract governance gate, source/core local gate

## Prompt, Knowledge, and Contract Governance
Prompt-like files changed: yes
Eval suite updated: yes
Knowledge map updated: yes
Task contract required: yes

## Task Contract
Goal: add v0.8.7 source harness governance only
Done criteria: v087 self-test pass; source/core local gate pass
Verification surface: source harness validation commands
Risk surface: source harness gate behavior
Allowed scope: source harness managed files
Forbidden scope: target repos, product runtime code, package/lockfile changes, profiles/*
Stop condition: stop if remote gate fails

## Load-bearing evidence
Component: v0.8.7 prompt/review/knowledge/contract governance
Failure mode caught: prompt-like policy regression
Not covered by existing gates: knowledge map and task contract integrity
Negative fixture: v087 self-test negative cases
Positive fixture: v087 self-test source harness-only v0.8.7 fixture
Runtime cost: low
Default mode: enforce for PR context

## Testing
Validation commands pass.
`;
}

function confirmationFixture(overrides = {}) {
  return {
    target: 'pull_request',
    repository: 'hiro4649/codex-development-harness',
    prNumber: 14,
    headSha: 'abc123',
    riskLevel: 'R3',
    confirmedByRole: 'project-owner',
    confirmedAt: '2026-05-25T00:00:00Z',
    reviewedItems: ['source harness managed files only'],
    residualRisks: ['target rollout remains separate'],
    qualityGateNotWeakened: true,
    riskLevelNotLowered: true,
    nonOverridableFailuresAcknowledged: true,
    ...overrides,
  };
}

function manualConfirmationBlock(object) {
  return `BEGIN_CODEX_MANUAL_CONFIRMATION_JSON\n${JSON.stringify({ codexManualConfirmation: object }, null, 2)}\nEND_CODEX_MANUAL_CONFIRMATION_JSON`;
}

function evidencePackConfirmationBlock(object) {
  return `BEGIN_CODEX_EVIDENCE_PACK_JSON\n${JSON.stringify({ codexEvidencePack: { humanConfirmation: object } }, null, 2)}\nEND_CODEX_EVIDENCE_PACK_JSON`;
}

function evidencePackFixture(overrides = {}) {
  return {
    schemaVersion: '0.8.7',
    harnessVersion: '0.8.7',
    repository: 'hiro4649/codex-development-harness',
    prNumber: 14,
    headSha: 'abc123',
    baseSha: 'base123',
    changeType: 'source-harness',
    riskLevel: 'R3',
    scope: {
      changedFiles: ['scripts/codex-evidence-pack-validate.mjs'],
      allowedPaths: ['scripts/codex-evidence-pack-validate.mjs'],
      forbiddenPaths: ['src/'],
    },
    commands: [{ name: 'node scripts/codex-v087-self-test.mjs', result: 'pass' }],
    remoteRuns: [{ provider: 'github-actions', workflow: 'quality-gate', runId: 'fixture', conclusion: 'pending', headSha: 'abc123', source: 'fixture', date: '2026-05-25' }],
    residualRisks: ['target rollout remains separate'],
    productionClaims: {
      claimsRuntimeReady: false,
      claimsDeploymentReady: false,
      claimsMergeReady: false,
      claimsProductionReady: false,
    },
    rollbackOrStopCondition: 'stop on current-head remote quality-gate failure',
    humanConfirmation: confirmationFixture(),
    safeOutput: { status: 'pass', unsafeFindings: [] },
    ...overrides,
  };
}

function evidencePackBlock(object) {
  return `BEGIN_CODEX_EVIDENCE_PACK_JSON\n${JSON.stringify({ codexEvidencePack: object }, null, 2)}\nEND_CODEX_EVIDENCE_PACK_JSON`;
}

function invalidEvidencePackBlock() {
  return 'BEGIN_CODEX_EVIDENCE_PACK_JSON\n{ "codexEvidencePack": \nEND_CODEX_EVIDENCE_PACK_JSON';
}

function humanConfirmationEnv(overrides = {}) {
  return prEnv({
    CODEX_HARNESS_SOURCE_REPO: '1',
    CODEX_HUMAN_CONFIRMATION_STRICT: '1',
    CODEX_PR_COMMENTS: '',
    CODEX_PR_REVIEWS: '',
    ...overrides,
  });
}

function evidencePackEnv(overrides = {}) {
  return prEnv({
    CODEX_HARNESS_SOURCE_REPO: '1',
    CODEX_EVIDENCE_PACK_STRICT: '1',
    CODEX_PR_COMMENTS: '',
    CODEX_PR_REVIEWS: '',
    ...overrides,
  });
}

export function buildV087SelfTestReport() {
  const failures = [];
  const cases = [];
  let result;

  result = buildPromptGovernanceReport(baseEnv()).promptGovernanceStatus;
  assertCase('no PR context -> not_applicable or pass', ['not_applicable', 'pass'].includes(result.status), failures, cases, result.status);

  result = buildPromptGovernanceReport(baseEnv({
    CODEX_CHANGED_FILES: 'README.md',
    CODEX_PROMPT_GOVERNANCE_MODE: 'report',
  })).promptGovernanceStatus;
  assertCase('docs-only prompt marker update -> warning or pass', ['warning', 'pass', 'not_applicable'].includes(result.status), failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'AGENTS.md',
    CODEX_PROMPT_EVAL_SUITE_PATH: tempJson({ cases: [] }),
  })).promptGovernanceStatus;
  assertCase('AGENTS change without eval -> fail', result.status === 'fail' && result.reasonCodes.includes('agents_change_without_prompt_eval'), failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: '.agents/skills/codex-bugfix/SKILL.md',
  })).promptGovernanceStatus;
  assertCase('skill change with matching eval -> pass', result.status === 'pass', failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: '.agents/skills/codex-bugfix/SKILL.md',
    CODEX_PROMPT_EVAL_SUITE_PATH: tempJson({ cases: [{ id: 'other_case', target: 'README.md', description: 'x', mustContain: ['Codex'], expectedStatus: 'pass', safeSummaryOnly: true }] }),
  })).promptGovernanceStatus;
  assertCase('skill change missing bugfix reproduction eval -> fail', result.status === 'fail' && result.reasonCodes.includes('skill_change_without_eval'), failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'docs/process/CODEX_CODE_REVIEW_MONITOR_POLICY.md',
    CODEX_REVIEW_EVAL_CASES_PATH: tempJson({ cases: [] }),
  })).promptGovernanceStatus;
  assertCase('review policy change without review eval -> fail', result.status === 'fail' && result.reasonCodes.includes('review_policy_change_without_review_eval'), failures, cases, result.status);

  result = buildReviewEvalSuiteReport().reviewEvalSuiteStatus;
  assertCase('review eval suite catches fixtures -> pass', result.status === 'pass', failures, cases, result.failures?.join(','));
  assertCase('review eval case catches bugfix missing root cause -> pass', result.cases.some((item) => item.id === 'bugfix_missing_root_cause_fail' && item.status === 'pass'), failures, cases);
  assertCase('review eval case catches auth negative test missing -> pass', result.cases.some((item) => item.id === 'auth_surface_without_negative_test_manual' && item.status === 'pass'), failures, cases);

  result = buildKnowledgeGovernanceReport().knowledgeGovernanceStatus;
  assertCase('knowledge map valid -> pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildKnowledgeGovernanceReport({ ...baseEnv(), CODEX_KNOWLEDGE_MAP_PATH: tempJson({ marker, harnessVersion: HARNESS_VERSION, safeSummaryOnly: true, policyIndex: [], skillIndex: [], evalIndex: [], contractIndex: [], sourceOfRecord: [] }) }).knowledgeGovernanceStatus;
  assertCase('knowledge map missing required policy -> fail', result.status === 'fail' && result.reasonCodes.includes('knowledge_required_policy_not_indexed'), failures, cases, result.status);

  result = buildKnowledgeGovernanceReport({ ...baseEnv(), CODEX_KNOWLEDGE_MAP_PATH: tempJson({ marker: 'CODEX_QUALITY_HARNESS_FILE v0.8.6', harnessVersion: '0.8.6', safeSummaryOnly: true, policyIndex: [], skillIndex: [], evalIndex: [], contractIndex: [], sourceOfRecord: [] }) }).knowledgeGovernanceStatus;
  assertCase('knowledge map deprecated marker -> warning or fail depending required file', ['warning', 'fail'].includes(result.status), failures, cases, result.status);

  result = buildKnowledgeGovernanceReport({ ...baseEnv(), CODEX_KNOWLEDGE_TEST_AGENTS_LONG: '1' }).knowledgeGovernanceStatus;
  assertCase('AGENTS long manual fixture -> fail', result.status === 'fail' && result.reasonCodes.includes('agents_context_too_manual_like'), failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-new-gate.mjs',
    CODEX_PR_BODY: 'PR profile: harness_workflow_r3\nRisk level: R3\nTask mode: harness_change',
  })).contractGovernanceStatus;
  assertCase('contract_missing_for_r3_harness_change -> fail', result.status === 'fail' && result.reasonCodes.includes('task_contract_missing'), failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-new-gate.mjs',
    CODEX_PR_BODY: sourcePrBody(),
  })).contractGovernanceStatus;
  assertCase('contract_with_done_and_verification -> pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildContractGovernanceReport(prEnv({
    CODEX_HANDOFF_JSON: JSON.stringify({ codexHandoff: { schemaVersion: '1.0.0', headSha: 'different', taskMode: 'harness_change', rawLogsStored: false, rawDiffStored: false, safeSummaryOnly: true } }),
  })).contractGovernanceStatus;
  assertCase('handoff_head_mismatch -> fail', result.status === 'fail' && result.reasonCodes.includes('handoff_head_mismatch'), failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_HANDOFF_JSON: JSON.stringify({ codexHandoff: { schemaVersion: '1.0.0', headSha: 'abc123', taskMode: 'harness_change', rawLogsStored: true, rawDiffStored: false, safeSummaryOnly: true } }),
  })).contractGovernanceStatus;
  assertCase('handoff_raw_logs_true -> fail', result.status === 'fail' && result.reasonCodes.includes('handoff_raw_artifact_forbidden'), failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-new-gate.mjs',
    CODEX_PR_BODY: `PR profile: harness_workflow_r3
Risk level: R3
Task mode: harness_change
## Task Contract
Goal: x
Done criteria: y
Verification surface: z
Risk surface: q
Allowed scope: source harness
Forbidden scope: target repos
Stop condition: stop`,
  })).contractGovernanceStatus;
  assertCase('load_bearing_missing_for_new_gate -> fail', result.status === 'fail' && result.reasonCodes.includes('load_bearing_evidence_missing'), failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-new-gate.mjs',
    CODEX_PR_BODY: sourcePrBody(),
  })).contractGovernanceStatus;
  assertCase('load_bearing_present_for_new_gate -> pass', result.status === 'pass', failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_PR_BODY: 'Runtime readiness claimed: yes\nDone when: fixture pass demonstrates stub behavior',
  })).contractGovernanceStatus;
  assertCase('stub_feature_with_runtime_ready_claim -> fail', result.status === 'fail' && result.reasonCodes.includes('stub_feature_claim_detected'), failures, cases, result.status);

  result = buildContractGovernanceReport(prEnv({
    CODEX_PR_BODY: 'Feature complete: yes\nDone when: display only screen exists',
  })).contractGovernanceStatus;
  assertCase('display_only_feature_complete_claim -> manual_confirmation_required', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('display_only_feature_claim_detected'), failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'docs/process/CODEX_PRODUCT_VERIFICATION_POLICY.md',
    CODEX_PR_BODY: 'product verification fail may pass',
  })).promptGovernanceStatus;
  assertCase('product verification weakening text -> fail', result.status === 'fail' && result.reasonCodes.includes('product_verification_prompt_weakened'), failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'docs/process/CODEX_MANUAL_CONFIRMATION_POLICY.md',
    CODEX_PR_BODY: 'manual confirmation can override non-overridable failures',
  })).promptGovernanceStatus;
  assertCase('manual override weakening text -> fail', result.status === 'fail' && result.reasonCodes.includes('manual_override_policy_weakened'), failures, cases, result.status);

  result = buildHumanConfirmationObjectReport(humanConfirmationEnv({
    CODEX_PR_COMMENTS: [
      manualConfirmationBlock({ headSha: 'abc123', status: 'pending_current_head_project_owner_confirmation' }),
      manualConfirmationBlock(confirmationFixture()),
    ].join('\n'),
  })).humanConfirmationObjectStatus;
  assertCase('human_confirmation_multiple_blocks_prefers_current_head_valid', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildHumanConfirmationObjectReport(humanConfirmationEnv({
    CODEX_PR_COMMENTS: [
      manualConfirmationBlock(confirmationFixture({ headSha: 'stale-head' })),
      manualConfirmationBlock(confirmationFixture()),
    ].join('\n'),
  })).humanConfirmationObjectStatus;
  assertCase('human_confirmation_stale_first_valid_second_pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildHumanConfirmationObjectReport(humanConfirmationEnv({
    CODEX_PR_COMMENTS: manualConfirmationBlock(confirmationFixture({ headSha: 'stale-head' })),
  })).humanConfirmationObjectStatus;
  assertCase('human_confirmation_only_stale_fails', result.status === 'fail' && result.reasonCodes.includes('head_sha_mismatch'), failures, cases, result.status);

  result = buildHumanConfirmationObjectReport(humanConfirmationEnv({
    CODEX_PR_COMMENTS: manualConfirmationBlock({ target: 'pull_request', headSha: 'abc123' }),
    CODEX_PR_BODY: manualConfirmationBlock(confirmationFixture()),
  })).humanConfirmationObjectStatus;
  assertCase('human_confirmation_incomplete_first_valid_body_pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildHumanConfirmationObjectReport(humanConfirmationEnv({
    CODEX_PR_COMMENTS: [
      evidencePackConfirmationBlock({ status: 'pending_current_head_project_owner_confirmation', target: 'pull_request', headSha: 'abc123' }),
      manualConfirmationBlock(confirmationFixture()),
    ].join('\n'),
  })).humanConfirmationObjectStatus;
  assertCase('human_confirmation_evidence_pack_pending_first_valid_second_pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildEvidencePackReport(evidencePackEnv({
    CODEX_PR_COMMENTS: [
      evidencePackBlock({ headSha: 'abc123' }),
      evidencePackBlock(evidencePackFixture()),
    ].join('\n'),
  })).evidencePackStatus;
  assertCase('evidence_pack_multiple_blocks_prefers_current_head_valid', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildEvidencePackReport(evidencePackEnv({
    CODEX_PR_COMMENTS: [
      evidencePackBlock(evidencePackFixture({ headSha: 'stale-head' })),
      evidencePackBlock(evidencePackFixture()),
    ].join('\n'),
  })).evidencePackStatus;
  assertCase('evidence_pack_stale_first_valid_second_pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildEvidencePackReport(evidencePackEnv({
    CODEX_PR_COMMENTS: evidencePackBlock(evidencePackFixture({ headSha: 'stale-head' })),
  })).evidencePackStatus;
  assertCase('evidence_pack_only_stale_fails', result.status === 'fail' && result.reasonCodes.includes('head_sha_mismatch'), failures, cases, result.status);

  result = buildEvidencePackReport(evidencePackEnv({
    CODEX_PR_COMMENTS: evidencePackBlock(evidencePackFixture({ headSha: 'stale-head' })),
    CODEX_PR_BODY: evidencePackBlock(evidencePackFixture()),
  })).evidencePackStatus;
  assertCase('evidence_pack_comment_stale_body_valid_pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildEvidencePackReport(evidencePackEnv({
    CODEX_PR_COMMENTS: [
      invalidEvidencePackBlock(),
      evidencePackBlock(evidencePackFixture()),
    ].join('\n'),
  })).evidencePackStatus;
  assertCase('evidence_pack_invalid_first_valid_second_pass', result.status === 'pass', failures, cases, result.reasonCodes?.join(','));

  result = buildPromptVariantSuggestionReport().promptVariantSuggestionStatus;
  assertCase('variant suggestion autoApply=false -> suggestion_only', result.status === 'suggestion_only' && result.autoApply === false, failures, cases, result.status);

  result = buildPromptVariantSuggestionReport({ CODEX_PROMPT_VARIANT_TEST_AUTO_APPLY: '1' }).promptVariantSuggestionStatus;
  assertCase('variant suggestion autoApply=true fixture -> fail', result.status === 'fail' && result.reasonCodes.includes('prompt_variant_auto_apply_forbidden'), failures, cases, result.status);

  result = buildPromptEvalSuiteReport({ CODEX_PROMPT_EVAL_TEST_UNSAFE: '1' }).promptEvalSuiteStatus;
  assertCase('unsafe prompt eval output -> fail', result.status === 'fail', failures, cases, result.status);

  result = buildPromptGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'docs/process/CODEX_PROMPT_GOVERNANCE_POLICY.md,docs/process/CODEX_REVIEW_EVAL_CASES.json,scripts/codex-prompt-governance-gate.mjs',
    CODEX_PR_BODY: sourcePrBody(),
  })).promptGovernanceStatus;
  const knowledge = buildKnowledgeGovernanceReport(prEnv({ CODEX_PR_BODY: sourcePrBody() })).knowledgeGovernanceStatus;
  const contract = buildContractGovernanceReport(prEnv({
    CODEX_CHANGED_FILES: 'scripts/codex-prompt-governance-gate.mjs',
    CODEX_PR_BODY: sourcePrBody(),
  })).contractGovernanceStatus;
  assertCase('source harness-only v0.8.7 PR fixture -> pass', result.status === 'pass' && knowledge.status === 'pass' && contract.status === 'pass', failures, cases, `${result.status}/${knowledge.status}/${contract.status}`);

  const script = spawnSync('node', ['scripts/codex-prompt-variant-suggest.mjs'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, CODEX_QUALITY_REPORT: 'json' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assertCase('prompt variant script smoke-run exits zero', script.status === 0 && script.stdout.includes('promptVariantSuggestionStatus'), failures, cases, script.stderr || script.status);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v087SelfTestStatus: {
      status: failures.length ? 'fail' : 'pass',
      casesRun: cases.length,
      failures,
      cases,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildV087SelfTestReport();
    writeJsonReport(report, 'CODEX_V087_SELF_TEST_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('v087SelfTestStatus', 'fail', { failures: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_V087_SELF_TEST_REPORT');
    process.exit(1);
  }
}
