#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { fileURLToPath } from 'node:url';
import { marker, HARNESS_VERSION, scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v100-gate-lib.mjs';

const CASES = [
  [
    "parent_harness_v099_required_pass",
    "buildParentHarnessDevelopmentReport",
    {},
    "parentHarnessDevelopmentStatus",
    "pass"
  ],
  [
    "parent_harness_missing_fails",
    "buildParentHarnessDevelopmentReport",
    {
      "parentVersion": ""
    },
    "parentHarnessDevelopmentStatus",
    "fail"
  ],
  [
    "parent_v099_self_test_pass_required",
    "buildParentHarnessSelfTestReport",
    {},
    "parentHarnessSelfTestStatus",
    "pass"
  ],
  [
    "new_v100_self_test_registered_pass",
    "buildNewHarnessSelfTestReport",
    {},
    "newHarnessSelfTestStatus",
    "pass"
  ],
  [
    "parent_gate_preservation_formal_evidence_pass",
    "buildParentGatePreservationReport",
    {},
    "parentGatePreservationStatus",
    "pass"
  ],
  [
    "parent_gate_preservation_lifeboat_only_fails",
    "buildParentGatePreservationReport",
    {
      "lifeboatOnlyPass": true
    },
    "parentGatePreservationStatus",
    "fail"
  ],
  [
    "version_succession_v099_to_v100_pass",
    "buildVersionSuccessionReport",
    {},
    "versionSuccessionStatus",
    "pass"
  ],
  [
    "version_succession_skip_parent_fails",
    "buildVersionSuccessionReport",
    {
      "skipParentVersion": true
    },
    "versionSuccessionStatus",
    "fail"
  ],
  [
    "workflow_plan_large_task_requires_decomposition",
    "buildWorkflowPlanReport",
    {
      "forceCheck": true,
      "largeTaskWithoutDecomposition": true
    },
    "workflowPlanStatus",
    "fail"
  ],
  [
    "workflow_plan_harness_only_fast_path_pass",
    "buildWorkflowPlanReport",
    {
      "forceCheck": true,
      "taskMode": "harness_change"
    },
    "workflowPlanStatus",
    "pass"
  ],
  [
    "workflow_plan_product_and_harness_mixed_fails",
    "buildWorkflowPlanReport",
    {
      "forceCheck": true,
      "productAndHarnessMixed": true
    },
    "workflowPlanStatus",
    "fail"
  ],
  [
    "task_graph_source_before_target_pass",
    "buildTaskGraphReport",
    {
      "forceCheck": true
    },
    "taskGraphStatus",
    "pass"
  ],
  [
    "task_graph_target_before_source_fails",
    "buildTaskGraphReport",
    {
      "forceCheck": true,
      "targetBeforeSource": true
    },
    "taskGraphStatus",
    "fail"
  ],
  [
    "task_graph_product_before_harness_repair_fails",
    "buildTaskGraphReport",
    {
      "forceCheck": true,
      "productBeforeHarnessRepair": true
    },
    "taskGraphStatus",
    "fail"
  ],
  [
    "parallel_worker_budget_readonly_five_pass",
    "buildParallelWorkerBudgetReport",
    {
      "readOnlyWorkers": 5
    },
    "parallelWorkerBudgetStatus",
    "pass"
  ],
  [
    "parallel_worker_budget_write_two_same_repo_fails",
    "buildParallelWorkerBudgetReport",
    {
      "writeWorkers": 2
    },
    "parallelWorkerBudgetStatus",
    "fail"
  ],
  [
    "branch_isolation_missing_base_sha_fails",
    "buildBranchIsolationReport",
    {
      "forceCheck": true,
      "baseShaMissing": true
    },
    "branchIsolationStatus",
    "fail"
  ],
  [
    "worker_file_ownership_same_file_two_workers_fails",
    "buildWorkerFileOwnershipReport",
    {
      "sameFileTwoWorkers": true
    },
    "workerFileOwnershipStatus",
    "fail"
  ],
  [
    "worker_file_ownership_agents_multi_edit_fails",
    "buildWorkerFileOwnershipReport",
    {
      "agentsMultiEdit": true
    },
    "workerFileOwnershipStatus",
    "fail"
  ],
  [
    "evidence_aggregation_same_head_pass",
    "buildEvidenceAggregationReport",
    {
      "forceCheck": true
    },
    "evidenceAggregationStatus",
    "pass"
  ],
  [
    "evidence_aggregation_stale_artifact_fails",
    "buildEvidenceAggregationReport",
    {
      "forceCheck": true,
      "staleArtifact": true
    },
    "evidenceAggregationStatus",
    "fail"
  ],
  [
    "merge_sequence_iris_before_funky_pass",
    "buildMergeSequenceReport",
    {
      "forceCheck": true
    },
    "mergeSequenceStatus",
    "pass"
  ],
  [
    "merge_sequence_funky_before_iris_fails",
    "buildMergeSequenceReport",
    {
      "forceCheck": true,
      "funkyBeforeIris": true
    },
    "mergeSequenceStatus",
    "fail"
  ],
  [
    "workflow_stop_condition_product_file_in_harness_rollout_fails",
    "buildWorkflowStopConditionReport",
    {
      "productFileMixed": true
    },
    "workflowStopConditionStatus",
    "fail"
  ],
  [
    "workflow_resume_rerun_404_empty_commit_hint",
    "buildWorkflowResumeReport",
    {
      "forceCheck": true,
      "resumePoint": "push_empty_commit_to_refresh_pr_context"
    },
    "workflowResumeStatus",
    "pass"
  ],
  [
    "workflow_cost_budget_exceeded_manual_required",
    "buildWorkflowCostBudgetReport",
    {
      "budgetExceeded": true
    },
    "workflowCostBudgetStatus",
    "manual_confirmation_required"
  ],
  [
    "codebase_map_generates_required_sections",
    "buildCodebaseMapReport",
    {
      "forceCheck": true
    },
    "codebaseMapStatus",
    "pass"
  ],
  [
    "entrypoint_map_missing_runtime_entry_warns",
    "buildEntrypointMapReport",
    {
      "forceCheck": true,
      "runtimeEntryMissing": true
    },
    "entrypointMapStatus",
    "warning"
  ],
  [
    "module_boundary_core_direct_external_api_fails",
    "buildModuleBoundaryReport",
    {
      "forceCheck": true,
      "coreDirectExternalApi": true
    },
    "moduleBoundaryStatus",
    "fail"
  ],
  [
    "dependency_graph_cycle_detected_warns",
    "buildDependencyGraphReport",
    {
      "forceCheck": true,
      "cycleDetected": true
    },
    "dependencyGraphStatus",
    "warning"
  ],
  [
    "data_flow_external_side_effect_unknown_warns",
    "buildDataFlowMapReport",
    {
      "forceCheck": true,
      "externalSideEffectUnknown": true
    },
    "dataFlowMapStatus",
    "warning"
  ],
  [
    "api_surface_admin_endpoint_without_auth_fails",
    "buildApiSurfaceMapReport",
    {
      "forceCheck": true,
      "adminEndpointWithoutAuth": true
    },
    "apiSurfaceMapStatus",
    "fail"
  ],
  [
    "db_usage_raw_rows_forbidden",
    "buildDbUsageMapReport",
    {
      "forceCheck": true,
      "rawRowsOutput": true
    },
    "dbUsageMapStatus",
    "fail"
  ],
  [
    "db_usage_migration_without_rollback_fails",
    "buildDbUsageMapReport",
    {
      "forceCheck": true,
      "migrationWithoutRollback": true
    },
    "dbUsageMapStatus",
    "fail"
  ],
  [
    "worker_batch_cron_without_timeout_warns",
    "buildWorkerBatchMapReport",
    {
      "forceCheck": true,
      "cronWithoutTimeout": true
    },
    "workerBatchMapStatus",
    "warning"
  ],
  [
    "external_integration_endpoint_value_forbidden",
    "buildExternalIntegrationMapReport",
    {
      "forceCheck": true,
      "endpointValuePrinted": true
    },
    "externalIntegrationMapStatus",
    "fail"
  ],
  [
    "security_surface_secret_exposure_fails",
    "buildSecuritySurfaceMapReport",
    {
      "forceCheck": true,
      "secretExposure": true
    },
    "securitySurfaceMapStatus",
    "fail"
  ],
  [
    "performance_hotspot_n_plus_one_candidate_warns",
    "buildPerformanceHotspotMapReport",
    {
      "forceCheck": true,
      "nPlusOneCandidate": true
    },
    "performanceHotspotMapStatus",
    "warning"
  ],
  [
    "service_cost_candidate_without_billing_no_claim",
    "buildServiceCostMapReport",
    {
      "forceCheck": true,
      "savingsClaimWithoutBilling": true
    },
    "serviceCostMapStatus",
    "fail"
  ],
  [
    "dead_code_dynamic_import_not_confirmed_unused",
    "buildDeadCodeCandidateReport",
    {
      "forceCheck": true,
      "dynamicImportConfirmedUnused": true
    },
    "deadCodeCandidateStatus",
    "fail"
  ],
  [
    "test_gap_product_change_without_test_warns",
    "buildTestGapMapReport",
    {
      "forceCheck": true,
      "productChangeWithoutTest": true
    },
    "testGapMapStatus",
    "warning"
  ],
  [
    "docs_implementation_conflict_detected",
    "buildDocsImplementationDriftReport",
    {
      "forceCheck": true,
      "docsImplementationConflictHidden": true
    },
    "docsImplementationDriftStatus",
    "fail"
  ],
  [
    "confidence_inferred_not_confirmed_pass",
    "buildConfidenceClassificationReport",
    {
      "forceCheck": true
    },
    "confidenceClassificationStatus",
    "pass"
  ],
  [
    "confidence_unknown_not_deleted_pass",
    "buildConfidenceClassificationReport",
    {
      "forceCheck": true
    },
    "confidenceClassificationStatus",
    "pass"
  ],
  [
    "handover_docs_required_for_handover_mode",
    "buildHandoverDocumentReport",
    {
      "forceCheck": true
    },
    "handoverDocumentStatus",
    "pass"
  ],
  [
    "improvement_backlog_refactor_behavior_change_mixed_fails",
    "buildImprovementBacklogReport",
    {
      "forceCheck": true,
      "refactorBehaviorChangeMixed": true
    },
    "improvementBacklogStatus",
    "fail"
  ],
  [
    "safe_cleanup_confirmed_unused_pass",
    "buildSafeCleanupPlanReport",
    {
      "forceCheck": true
    },
    "safeCleanupPlanStatus",
    "pass"
  ],
  [
    "safe_cleanup_inferred_unused_delete_fails",
    "buildSafeCleanupPlanReport",
    {
      "forceCheck": true,
      "deleteWithoutConfirmedUnused": true
    },
    "safeCleanupPlanStatus",
    "fail"
  ],
  [
    "behavior_preservation_refactor_without_test_fails",
    "buildBehaviorPreservationReport",
    {
      "forceCheck": true,
      "refactorWithoutTest": true
    },
    "behaviorPreservationStatus",
    "fail"
  ],
  [
    "public_contract_breaking_change_unstated_fails",
    "buildPublicContractChangeReport",
    {
      "forceCheck": true,
      "breakingChangeUnstated": true
    },
    "publicContractChangeStatus",
    "fail"
  ],
  [
    "runtime_readiness_fixture_only_fails",
    "buildRuntimeReadinessBoundaryReport",
    {
      "runtimeReadinessClaimed": true
    },
    "runtimeReadinessBoundaryStatus",
    "fail"
  ],
  [
    "production_go_without_oracle_fails",
    "buildProductionGoBoundaryReport",
    {
      "productionReadinessClaimed": true
    },
    "productionGoBoundaryStatus",
    "fail"
  ],
  [
    "source_harness_only_v100_fixture_pass",
    "buildWorkflowPlanReport",
    {
      "forceCheck": true,
      "taskMode": "harness_change"
    },
    "workflowPlanStatus",
    "pass"
  ],
  [
    "target_harness_rollout_v100_fixture_pass",
    "buildMergeSequenceReport",
    {
      "forceCheck": true
    },
    "mergeSequenceStatus",
    "pass"
  ]
];
function statusOf(report, key) { return report[key]?.status || report.status || 'missing'; }
function reasonsOf(report, key) { return report[key]?.reasonCodes || []; }
export function buildV100SelfTestReport() {
  const failures = [];
  const out = [];
  for (const [id, builderName, input, key, expected] of CASES) {
    const report = gates[builderName](input);
    const actualStatus = statusOf(report, key);
    const ok = actualStatus === expected;
    out.push({ caseIndex: out.length + 1, status: ok ? 'pass' : 'fail', actualStatus, reasonCodes: reasonsOf(report, key), safeSummaryOnly: true });
    if (!ok) failures.push(id);
  }
  const unsafe = scanObjectForUnsafe(out);
  const status = failures.length || unsafe.length ? 'fail' : 'pass';
  return { marker, harnessVersion: HARNESS_VERSION, status, v100SelfTestStatus: { status, suite: 'v100', caseCount: out.length, failedCaseCount: failures.length, failedCases: failures.map((id) => CASES.findIndex((item) => item[0] === id) + 1), cases: out, reasonCodes: unsafe.length ? ['unsafe_output_detected'] : [], safeSummaryOnly: true }, cases: out, safeSummaryOnly: true };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { const report = buildV100SelfTestReport(); writeJsonReport(report, 'CODEX_V100_SELF_TEST_REPORT'); exitFor(report); }
