#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildPublicContractChangeReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildPublicContractChangeReport };

runV100GateCli(import.meta.url, process.argv[1], buildPublicContractChangeReport, 'CODEX_PUBLIC_CONTRACT_CHANGE_REPORT');
