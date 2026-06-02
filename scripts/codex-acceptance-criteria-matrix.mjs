#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { runV104Cli } from './codex-v104-gate-lib.mjs';
runV104Cli('acceptance', 'CODEX_ACCEPTANCE_CRITERIA_MATRIX_REPORT');
