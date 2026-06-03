#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function buildPromptVariantSuggestionReport(env = process.env) {
  const unsafeFixture = env.CODEX_PROMPT_VARIANT_TEST_UNSAFE === '1';
  const autoApply = env.CODEX_PROMPT_VARIANT_TEST_AUTO_APPLY === '1';
  const autoCommit = env.CODEX_PROMPT_VARIANT_TEST_AUTO_COMMIT === '1';
  const autoPush = env.CODEX_PROMPT_VARIANT_TEST_AUTO_PUSH === '1';
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    promptVariantSuggestionStatus: {
      status: autoApply || autoCommit || autoPush || unsafeFixture ? 'fail' : 'suggestion_only',
      autoApply,
      autoCommit,
      autoPush,
      candidateCount: env.CODEX_PROMPT_VARIANT_NOT_RUN === '1' ? 0 : 1,
      safeSuggestions: env.CODEX_PROMPT_VARIANT_NOT_RUN === '1'
        ? []
        : ['Keep prompt variants review-only and evaluate them with deterministic fixtures before any manual edit.'],
      reasonCodes: [
        ...(autoApply ? ['prompt_variant_auto_apply_forbidden'] : []),
        ...(autoCommit ? ['prompt_variant_auto_apply_forbidden'] : []),
        ...(autoPush ? ['prompt_variant_auto_apply_forbidden'] : []),
        ...(unsafeFixture ? ['prompt_variant_report_invalid'] : []),
      ],
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
  };
  if (scanObjectForUnsafe(report).length) {
    report.promptVariantSuggestionStatus.status = 'fail';
    report.promptVariantSuggestionStatus.reasonCodes = ['prompt_variant_report_invalid'];
  }
  report.status = report.promptVariantSuggestionStatus.status === 'fail' ? 'fail' : 'suggestion_only';
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildPromptVariantSuggestionReport();
    writeJsonReport(report, 'CODEX_PROMPT_VARIANT_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('promptVariantSuggestionStatus', 'fail', { reasonCodes: ['prompt_variant_report_invalid'] });
    writeJsonReport(report, 'CODEX_PROMPT_VARIANT_REPORT');
    process.exit(1);
  }
}
