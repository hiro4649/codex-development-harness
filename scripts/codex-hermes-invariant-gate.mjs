#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  evidenceFacts,
  manualOverrideLabels,
  readPrBody,
  unsafeLabels,
} from './codex-production-readiness-gate.mjs';

function containsSelfAssertionOnly(body) {
  const lower = body.toLowerCase();
  return /\b(self asserted|trust me|no evidence needed|because i say so)\b/.test(lower) ||
    (/\bpass\b/.test(lower) && !/\bcommand\b|\bsource\b|\bdate\b|\bgithub actions\b|\bexit\b/.test(lower));
}

function hasPlanEvidence(body) {
  return /\bplan-first status\b[\s\S]{0,160}\b(done|reviewed|approved|not required with reason)\b/i.test(body) ||
    /\bplan before coding\b/i.test(body);
}

function hasReviewEvidence(body) {
  return /\bcode review status\b[\s\S]{0,160}\b(self-reviewed|reviewed|docs\/process\/code_review\.md|not required with reason)\b/i.test(body) ||
    /\breviewed against docs\/process\/code_review\.md\b/i.test(body);
}

function residualRisksHidden(body) {
  const match = body.match(/(?:residual risks?|known risks?)\s*:?\s*([\s\S]{0,160})/i);
  if (!match) return true;
  const value = match[1].trim().toLowerCase();
  return !value || /^(none|n\/a|na|no risks|tbd|todo)\b/.test(value);
}

function buildHermesInvariantReport(env = process.env) {
  const bodyInfo = readPrBody(env);
  const body = bodyInfo.body || '';
  const failures = [];
  const warnings = [];
  const labels = [];

  failures.push(...unsafeLabels('hermesInput', body));
  failures.push(...manualOverrideLabels(body));

  if (bodyInfo.prContext && !body.trim()) failures.push('pr_body_missing');
  if (!bodyInfo.prContext && !body.trim()) {
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      hermesInvariantStatus: {
        status: 'not_applicable',
        labels: ['non_pr_no_hermes_context'],
        failures,
        warnings,
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      productionReadyClaim: 'NO',
      status: 'not_applicable',
      safeSummary: 'Hermes invariant gate is not applicable for non-PR execution without risk or readiness claims.',
    };
  }

  const facts = evidenceFacts(body, env);
  const lower = body.toLowerCase();
  if (containsSelfAssertionOnly(body)) failures.push('self_assertion_only');
  if (facts.productionClaim && (!facts.command || !facts.result || !facts.rollback)) failures.push('unsafe_production_claim');
  if (!facts.reasonedSkip) failures.push('human_needed_or_skipped_check_hidden');
  if (facts.risky && !facts.humanReview) failures.push('r3_human_review_missing');
  if (facts.risky && !hasPlanEvidence(body)) failures.push('plan_first_required_but_missing');
  if (facts.risky && !hasReviewEvidence(body)) failures.push('review_status_missing_evidence');
  if (residualRisksHidden(body)) failures.push('residual_risks_hidden_or_empty');
  if (/\bboundary\b|\bscope\b|\bcontract\b/i.test(body) && facts.risky && !facts.humanReview) {
    failures.push('boundary_ambiguity_without_human_review');
  }
  if (/\brollback\b|\bstop condition\b/i.test(body)) labels.push('rollback_or_stop_condition_present');
  else if (facts.risky || facts.productionClaim) failures.push('rollback_or_stop_condition_missing_for_risk');
  if (/\bsafe summary only\b/i.test(body)) labels.push('safe_summary_only_declared');
  if (/\bexternal evidence\b|\bgithub actions\b|\bci\b|\bsource:\s*(local|ci|manual)\b/i.test(body)) labels.push('external_or_local_evidence_declared');
  if (/\boverride\b/i.test(lower) && failures.some((item) => item.startsWith('manual_override_attempt'))) {
    failures.push('manual_override_of_non_overridable_failure');
  }
  const status = failures.length ? 'fail' : warnings.length ? 'manual_confirmation_required' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    hermesInvariantStatus: {
      status,
      labels,
      failures,
      warnings,
      invariants: {
        externalEvidencePreferred: labels.includes('external_or_local_evidence_declared') || !facts.risky,
        boundaryProtected: !failures.includes('boundary_ambiguity_without_human_review'),
        safeSummaryOnly: !unsafeLabels('hermesReport', JSON.stringify({ labels, failures, warnings })).length,
        humanJudgmentVisible: facts.humanReview || !facts.risky,
        nonOverridableFailuresProtected: !failures.includes('manual_override_of_non_overridable_failure'),
        productionClaimRequiresEvidence: !failures.includes('unsafe_production_claim'),
        rollbackOrStopConditionVisible: labels.includes('rollback_or_stop_condition_present') || !facts.risky,
        planAndReviewEvidence: (!facts.risky || (hasPlanEvidence(body) && hasReviewEvidence(body))),
      },
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    productionReadyClaim: 'NO',
    status,
    safeSummary: status === 'pass'
      ? 'Hermes invariant gate passed.'
      : status === 'manual_confirmation_required'
        ? 'Hermes invariant gate requires manual confirmation for safe labels.'
        : 'Hermes invariant gate failed; see safe labels only.',
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_HERMES_INVARIANT_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`hermesInvariantStatus: ${report.hermesInvariantStatus.status}`);
    console.log(report.safeSummary);
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

export { buildHermesInvariantReport };

if (isMain()) {
  try {
    const report = buildHermesInvariantReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      hermesInvariantStatus: {
        status: 'fail',
        labels: ['unexpected_error'],
        failures: ['hermes_invariant_gate_unexpected_error'],
        warnings: [],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      productionReadyClaim: 'NO',
      status: 'fail',
      safeSummary: 'Hermes invariant gate failed with an internal error.',
    };
    printReport(report);
    process.exit(1);
  }
}
