#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildThreatModelReport } from './codex-v108-gate-lib.mjs';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...buildThreatModelReport({
    finderApprovesOwnFinding: process.env.CODEX_FINDER_SELF_APPROVES === '1',
    patcherVerifiesOwnPatch: process.env.CODEX_PATCHER_SELF_VERIFIES === '1',
    targetExecutionWithoutSandbox: process.env.CODEX_TARGET_EXECUTION_WITHOUT_SANDBOX === '1',
    networkEgressAllowedByDefault: process.env.CODEX_NETWORK_EGRESS_DEFAULT_ALLOW === '1',
  }),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_THREAT_MODEL_FIRST_REPORT');
exitFor(report);
