#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildWorkflowProductVerificationInvariantReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildWorkflowProductVerificationInvariantReport };

runV097GateCli(import.meta.url, process.argv[1], buildWorkflowProductVerificationInvariantReport, 'CODEX_WORKFLOW_PRODUCT_VERIFICATION_INVARIANT_REPORT');
