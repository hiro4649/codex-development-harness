#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildConfidenceClassificationReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildConfidenceClassificationReport };

runV100GateCli(import.meta.url, process.argv[1], buildConfidenceClassificationReport, 'CODEX_CONFIDENCE_CLASSIFICATION_REPORT');
