#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import process from 'node:process';

const reportPath = process.env.CODEX_QUALITY_REPORT_PATH || process.env.CODEX_LOCAL_QUALITY_REPORT_PATH || '';
let report = {};
if (reportPath && fs.existsSync(reportPath)) {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, ''));
}

function statusOf(key) {
  return report?.[key]?.status || 'not_run';
}

const lines = [
  '## v0.7.0 purpose',
  'OpenAI Codex Method Gate: PR task shape, plan-first evidence, review basis, and safe-output discipline are CI-enforced.',
  '',
  '## Changed files',
  'See git diff file list for harness-managed source/profile files only.',
  '',
  '## Verification results',
  `sourceHarnessValidationStatus: ${statusOf('sourceHarnessValidationStatus')}`,
  `agentMemoryPolicyStatus: ${statusOf('agentMemoryPolicyStatus')}`,
  `skillLifecyclePolicyStatus: ${statusOf('skillLifecyclePolicyStatus')}`,
  `curatorSuggestionStatus: ${statusOf('curatorSuggestionStatus')}`,
  `selfEvolutionPolicyStatus: ${statusOf('selfEvolutionPolicyStatus')}`,
  `safeArtifactValidation: ${statusOf('safeArtifactValidation')}`,
  `outputShapeStatus: ${statusOf('outputShapeStatus')}`,
  `openaiCodexMethodStatus: ${statusOf('openaiCodexMethodStatus')}`,
  'suggestion-only side effects: none when gate passes',
  '',
  '## Codex Method reminder',
  'Include Goal, Context, Constraints, Done when, Files or scope, Plan-first status, Environment setup, Testing and review, Residual risks, Best of N used or skipped, Code review status, and Human confirmation needed.',
  '',
  '## Not propagated',
  '- FUNKY real development repository',
  '- IRIS real development repository',
  '- IRIS-live2d-renderer real development repository',
  '',
  '## Residual risks',
  'Real development repositories are not updated by this PR.',
  '',
  '## Human confirmation points',
  'Confirm source harness validation, new policy status, suggestion-only behavior, and that local quality gate is not failing before PR creation.',
];

if (report?.status === 'fail') {
  lines.unshift('PR creation prohibited: local quality gate is failing.', '');
}

console.log(lines.join('\n'));
