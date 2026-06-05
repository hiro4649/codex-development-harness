#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildReviewEvidenceReport } from './codex-v108-gate-lib.mjs';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...buildReviewEvidenceReport({
    required: process.env.CODEX_REVIEW_REQUIRED === '1',
    writerOnly: process.env.CODEX_REVIEW_WRITER_ONLY === '1',
    botOnly: process.env.CODEX_REVIEW_BOT_ONLY === '1',
    reviewRequestOnly: process.env.CODEX_REVIEW_REQUEST_ONLY === '1',
    independentApprovalSameHead: process.env.CODEX_REVIEW_INDEPENDENT_SAME_HEAD === '1',
    independentApprovalStale: process.env.CODEX_REVIEW_INDEPENDENT_STALE === '1',
  }),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_REVIEW_EVIDENCE_INTAKE_REPORT');
exitFor(report);
