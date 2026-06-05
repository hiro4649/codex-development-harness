#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildBranchLaneIsolationReport } from './codex-v108-gate-lib.mjs';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...buildBranchLaneIsolationReport({
    isolatedWorktreeUsed: process.env.CODEX_ISOLATED_WORKTREE_USED !== '0',
    parentBranchBefore: process.env.CODEX_PARENT_BRANCH_BEFORE || 'main',
    parentBranchAfter: process.env.CODEX_PARENT_BRANCH_AFTER || process.env.CODEX_PARENT_BRANCH_BEFORE || 'main',
    parentHeadBefore: process.env.CODEX_PARENT_HEAD_BEFORE || 'safe_hash',
    parentHeadAfter: process.env.CODEX_PARENT_HEAD_AFTER || process.env.CODEX_PARENT_HEAD_BEFORE || 'safe_hash',
    parentTrackedMutation: process.env.CODEX_PARENT_TRACKED_MUTATION === '1',
  }),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_TARGET_HARNESS_ISOLATION_REPORT');
exitFor(report);
