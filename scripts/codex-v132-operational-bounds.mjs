#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, sha256, V132_VERSION } from './codex-v132-evidence-truth.mjs';

export const V132_OUTPUT_LIMITS = Object.freeze({
  compactJsonBytes: 8192,
  decisionCapsuleBytes: 2048,
  safeSummaryBytes: 3584,
  orchestrationReceiptBytes: 24576,
  fullDiagnosticsBytes: 131072,
  topLevelFieldCount: 64,
  displayPathBytes: 256,
  reasonCodeBytes: 128,
});

export const V132_LONG_RUN_BUDGET = Object.freeze({
  wallClockMinutesMax: 120,
  toolCallsMax: 300,
  fileWritesMax: 100,
  retryPerNodeMax: 1,
  parallelAgentRuntimeMax: 1,
  checkpointEveryCompletedNodes: 3,
  heartbeatSummaryBytesMax: 512,
});

export function truncateUtf8(value, maxBytes) {
  const text = String(value ?? '');
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  const suffix = '...';
  let end = text.length;
  while (end > 0 && Buffer.byteLength(`${text.slice(0, end)}${suffix}`, 'utf8') > maxBytes) end -= 1;
  return `${text.slice(0, end)}${suffix}`;
}

export function boundedSample(values = [], { maxEntries = 16, maxEntryBytes = 256 } = {}) {
  const exactCount = Array.isArray(values) ? values.length : 0;
  const sample = (Array.isArray(values) ? values : [])
    .slice(0, maxEntries)
    .map((value) => truncateUtf8(value, maxEntryBytes));
  return { exactCount, sample, omittedCount: Math.max(0, exactCount - sample.length) };
}

export function measureJson(value) {
  return { bytes: Buffer.byteLength(JSON.stringify(value), 'utf8'), topLevelFields: Object.keys(value || {}).length };
}

function normalizeRelativePath(value) {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function pathSafetyReasons(file, repoRoot) {
  const original = String(file ?? '');
  const normalized = normalizeRelativePath(original);
  const reasons = [];
  if (!normalized || Buffer.byteLength(normalized, 'utf8') > V132_OUTPUT_LIMITS.displayPathBytes) reasons.push('target_path_unbounded');
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/') || normalized.startsWith('//')) reasons.push('target_path_absolute');
  if (/[\x00-\x1f\x7f]/.test(original)) reasons.push('target_path_control_character');
  if (normalized.split('/').includes('..')) reasons.push('target_path_traversal');
  if (normalized.split('/').at(-1) === 'CODEX_SOURCE_HARNESS_MANIFEST.json') reasons.push('source_manifest_copy_forbidden');
  if (repoRoot && !reasons.length) {
    const root = path.resolve(repoRoot);
    const resolved = path.resolve(root, normalized);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) reasons.push('target_path_escape');
    let cursor = root;
    for (const part of normalized.split('/')) {
      cursor = path.join(cursor, part);
      if (!fs.existsSync(cursor)) continue;
      try {
        if (fs.lstatSync(cursor).isSymbolicLink()) {
          const real = fs.realpathSync(cursor);
          if (real !== root && !real.startsWith(`${root}${path.sep}`)) reasons.push('target_symlink_escape');
        }
      } catch {
        reasons.push('target_path_inspection_failed');
      }
    }
  }
  return { normalized, reasons };
}

export function planTargetInstallDryRun({ profileClass, changedFiles = [], policy = {}, repoRoot } = {}) {
  const allowed = new Set(policy.targetPlanner?.profileAllowedFiles?.[profileClass] || []);
  const accepted = [];
  const rejected = [];
  for (const file of changedFiles) {
    const inspected = pathSafetyReasons(file, repoRoot);
    const reasons = [...inspected.reasons];
    if (!reasons.length && !allowed.has(inspected.normalized)) reasons.push('target_path_not_allowlisted');
    if (reasons.length) rejected.push({ path: truncateUtf8(inspected.normalized, 256), reasonCodes: [...new Set(reasons)] });
    else accepted.push(inspected.normalized);
  }
  return {
    schemaVersion: V132_VERSION,
    mode: 'dry_run_only',
    automaticMutationAllowed: false,
    profileClass,
    status: rejected.length ? 'fail_closed' : 'pass',
    accepted: boundedSample(accepted),
    rejected: boundedSample(rejected.map((entry) => `${entry.path}:${entry.reasonCodes.join('+')}`)),
    rejectedExactCount: rejected.length,
    knownFixtureFalseNegativeCount: 0,
    authority: false,
  };
}

function parseWorkflowTopology(file, text) {
  const beforePermissions = text.split(/^permissions:/m)[0] || '';
  const automaticPullRequest = /^  pull_request:/m.test(beforePermissions);
  const jobsIndex = text.search(/^jobs:\s*$/m);
  const jobsBlock = jobsIndex >= 0 ? text.slice(jobsIndex) : '';
  const jobMatches = [...jobsBlock.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)];
  const jobs = jobMatches.map((match, index) => {
    const segment = jobsBlock.slice(match.index, jobMatches[index + 1]?.index ?? jobsBlock.length);
    let expansion = 1;
    const include = segment.match(/^\s{8}include:\s*$([\s\S]*?)(?=^\s{6}\S|^\s{4}\S|(?![\s\S]))/m)?.[1] || '';
    const includeCount = (include.match(/^\s{10}-\s/gm) || []).length;
    if (includeCount) expansion = includeCount;
    else {
      const dimensions = [...segment.matchAll(/^\s{8}([A-Za-z0-9_-]+):\s*\[([^\]]*)\]\s*$/gm)]
        .map((item) => item[2].split(',').map((value) => value.trim()).filter(Boolean).length)
        .filter((count) => count > 0);
      if (dimensions.length) expansion = dimensions.reduce((product, count) => product * count, 1);
    }
    return { name: match[1], matrixExpansion: expansion };
  });
  return { file, automaticPullRequest, jobs };
}

export function inspectWorkflowTopology(repoRoot = process.cwd()) {
  const directory = path.join(repoRoot, '.github', 'workflows');
  const workflows = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((name) => /\.ya?ml$/i.test(name)).sort()
      .map((name) => parseWorkflowTopology(name, fs.readFileSync(path.join(directory, name), 'utf8')))
    : [];
  const automatic = workflows.filter((workflow) => workflow.automaticPullRequest);
  return {
    estimatedWorkflowRuns: automatic.length,
    estimatedJobs: automatic.reduce((sum, workflow) => sum + workflow.jobs.reduce((jobSum, job) => jobSum + job.matrixExpansion, 0), 0),
    matrixExpansionCount: automatic.reduce((sum, workflow) => sum + workflow.jobs.reduce((jobSum, job) => jobSum + Math.max(0, job.matrixExpansion - 1), 0), 0),
    workflowNames: automatic.map((workflow) => workflow.file),
    triggerReasons: automatic.map((workflow) => `${workflow.file}:pull_request`),
    manualRunsRequired: 0,
    confidence: 'constrained_static_workflow_analysis',
    workflows,
  };
}

export function planCiCost({ repoRoot, changeClass = 'source_core', duplicateEvidenceRefresh = false, manualRunCount = 0 } = {}) {
  const actual = repoRoot ? inspectWorkflowTopology(repoRoot) : null;
  let estimatedJobCount = actual?.estimatedJobs ?? (changeClass === 'docs_only' ? 1 : changeClass === 'target_metadata' ? 2 : 3);
  if (duplicateEvidenceRefresh) estimatedJobCount = 0;
  const workflowRunCount = duplicateEvidenceRefresh ? 0 : (actual?.estimatedWorkflowRuns ?? (estimatedJobCount ? 1 : 0));
  return {
    status: estimatedJobCount <= 4 && manualRunCount === 0 ? 'pass' : 'over_budget',
    workflowRunCount,
    estimatedJobCount,
    estimatedWorkflowRuns: workflowRunCount,
    estimatedJobs: estimatedJobCount,
    matrixExpansionCount: duplicateEvidenceRefresh ? 0 : (actual?.matrixExpansionCount ?? 0),
    manualRunCount,
    manualRunsRequired: manualRunCount,
    workflowNames: duplicateEvidenceRefresh ? [] : (actual?.workflowNames || []),
    triggerReasons: duplicateEvidenceRefresh ? ['duplicate_evidence_refresh'] : (actual?.triggerReasons || [`${changeClass}:declared_estimate`]),
    confidence: actual?.confidence || 'declared_estimate',
    sourceCoreHardMaximum: 4,
    heavyPullRequestTriggers: ['opened', 'synchronize', 'reopened'],
    pullRequestEditedTriggersHeavyWorkflow: false,
    rerunPlanned: false,
    estimatedActionsImpact: estimatedJobCount === 0 ? 'none' : `${workflowRunCount}_workflow_${estimatedJobCount}_jobs`,
    authority: false,
  };
}

export function validateCompatibilityDebtClosure(entries = []) {
  const allowed = new Set(['resolved', 'reclassified_with_reason', 'extended_once_with_owner_reason']);
  const reasons = [];
  for (const [index, entry] of entries.entries()) {
    if (entry.mustReviewBefore === V132_VERSION && !allowed.has(entry.disposition)) reasons.push(`debt_${index}_disposition_missing`);
    if (entry.disposition === 'reclassified_with_reason' && !entry.reason) reasons.push(`debt_${index}_reason_missing`);
    if (entry.disposition === 'extended_once_with_owner_reason' && !entry.ownerReason) reasons.push(`debt_${index}_owner_reason_missing`);
    if (entry.silentExtension === true) reasons.push(`debt_${index}_silent_extension_forbidden`);
  }
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, authority: false };
}

export function evaluateLongRunBudget(usage = {}) {
  const measured = {
    wallClockMinutes: Number(usage.wallClockMinutes || 0),
    toolCalls: Number(usage.subprocessExecutions ?? usage.toolCalls ?? 0),
    subprocessExecutions: Number(usage.subprocessExecutions ?? usage.toolCalls ?? 0),
    fileWrites: Number(usage.fileWrites || 0),
    retryPerNode: Number(usage.retryPerNode || 0),
    retryCount: Number(usage.retryCount || 0),
    checkpointCount: Number(usage.checkpointCount || 0),
    parallelAgentRuntime: Number(usage.parallelAgentRuntime || 0),
  };
  const exceeded = Object.entries({
    wallClockMinutes: V132_LONG_RUN_BUDGET.wallClockMinutesMax,
    toolCalls: V132_LONG_RUN_BUDGET.toolCallsMax,
    fileWrites: V132_LONG_RUN_BUDGET.fileWritesMax,
    retryPerNode: V132_LONG_RUN_BUDGET.retryPerNodeMax,
    parallelAgentRuntime: V132_LONG_RUN_BUDGET.parallelAgentRuntimeMax,
  }).filter(([key, limit]) => measured[key] > limit).map(([key]) => `${key}_budget_exceeded`);
  return {
    status: exceeded.length ? 'checkpoint_stop' : 'within_budget',
    reasonCodes: exceeded,
    usage: measured,
    accountingSemantics: 'actual_direct_subprocess_harness_write_retry_checkpoint_counters',
    budget: V132_LONG_RUN_BUDGET,
    authority: false,
  };
}

function enforceLimit(label, value, maxBytes) {
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (bytes > maxBytes) throw new Error(`${label}_byte_limit_exceeded:${bytes}:${maxBytes}`);
  return bytes;
}

export function buildDecisionCapsuleV3({ repository, headSha, canonicalState, blockerCodes = [], nextSafeAction } = {}) {
  const capsule = {
    schemaVersion: '3.0',
    repository: truncateUtf8(repository, 256),
    headSha,
    localValidationState: canonicalState.localValidationState,
    remoteValidationState: canonicalState.remoteValidationState,
    technicalMergeEligibility: canonicalState.technicalMergeEligibility,
    finalDecisionState: canonicalState.finalDecisionState,
    mergeAllowed: canonicalState.mergeAllowed === true,
    blockerCodes: boundedSample(blockerCodes, { maxEntries: 8, maxEntryBytes: 128 }),
    nextSafeAction: truncateUtf8(nextSafeAction, 256),
    authority: false,
  };
  capsule.digest = sha256(canonicalJson(capsule));
  capsule.bytes = enforceLimit('decision_capsule', capsule, V132_OUTPUT_LIMITS.decisionCapsuleBytes);
  return capsule;
}

export function buildSafeSummary({ repository, headSha, canonicalState, blockerCodes = [], nextSafeAction } = {}) {
  const summary = {
    schemaVersion: V132_VERSION,
    repository: truncateUtf8(repository, 256),
    headSha,
    state: `${canonicalState.localValidationState}/${canonicalState.remoteValidationState}/${canonicalState.technicalMergeEligibility}`,
    mergeAllowed: canonicalState.mergeAllowed === true,
    blockers: boundedSample(blockerCodes, { maxEntries: 12, maxEntryBytes: 128 }),
    nextSafeAction: truncateUtf8(nextSafeAction, 256),
    rawLogsStored: false,
    rawPromptsStored: false,
    authority: false,
  };
  summary.bytes = enforceLimit('safe_summary', summary, V132_OUTPUT_LIMITS.safeSummaryBytes);
  return summary;
}

export function buildOrchestrationReceipt({ plan, execution, repository, baseSha, headSha } = {}) {
  const receipt = {
    schemaVersion: V132_VERSION,
    schedulerType: 'deterministic_validation_graph',
    repository,
    baseSha,
    headSha,
    selectedNodeIds: (plan?.selectedNodes || []).map((node) => node.nodeId),
    reusedNodeIds: (plan?.reusedNodes || []).map((node) => node.nodeId),
    executedNodeIds: (execution?.executedNodeResults || []).map((node) => node.nodeId),
    executedOutputDigests: (execution?.executedNodeResults || []).map((node) => node.outputDigest),
    selectedNodeCount: plan?.selectedNodeCount || 0,
    skippedNodeCount: plan?.skippedNodeCount || 0,
    executedNodeCount: execution?.executedNodeCount ?? 0,
    reusedNodeCount: execution?.reusedNodeCount ?? 0,
    executorVersion: execution?.executorVersion || null,
    exactHeadNodeSkipRate: plan?.exactHeadNodeSkipRate || 0,
    graphDigest: plan?.digests?.graphDigest,
    diffDigest: plan?.digests?.diffDigest,
    agentTeamRuntime: false,
    authority: false,
  };
  receipt.digest = sha256(canonicalJson(receipt));
  receipt.bytes = enforceLimit('orchestration_receipt', receipt, V132_OUTPUT_LIMITS.orchestrationReceiptBytes);
  return receipt;
}

export function finalizeCompactOutput(report) {
  if (Object.keys(report).length > V132_OUTPUT_LIMITS.topLevelFieldCount) throw new Error('compact_top_level_field_limit_exceeded');
  for (let index = 0; index < 4; index += 1) {
    const bytes = Buffer.byteLength(JSON.stringify(report), 'utf8');
    report.outputMetrics = { ...(report.outputMetrics || {}), compactJsonBytes: bytes, topLevelFieldCount: Object.keys(report).length };
  }
  const metrics = measureJson(report);
  if (metrics.bytes > V132_OUTPUT_LIMITS.compactJsonBytes) throw new Error(`compact_json_byte_limit_exceeded:${metrics.bytes}`);
  if (metrics.topLevelFields > V132_OUTPUT_LIMITS.topLevelFieldCount) throw new Error('compact_top_level_field_limit_exceeded');
  report.outputMetrics.compactJsonBytes = metrics.bytes;
  report.outputMetrics.topLevelFieldCount = metrics.topLevelFields;
  return report;
}

export function validateFullDiagnostics(value) {
  const bytes = enforceLimit('full_diagnostics', value, V132_OUTPUT_LIMITS.fullDiagnosticsBytes);
  return { status: 'pass', bytes, maxBytes: V132_OUTPUT_LIMITS.fullDiagnosticsBytes, authority: false };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ limits: V132_OUTPUT_LIMITS, longRunBudget: V132_LONG_RUN_BUDGET }, null, 2));
}
