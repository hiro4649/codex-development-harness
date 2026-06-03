#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildDependencyGraphReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildDependencyGraphReport };

runV100GateCli(import.meta.url, process.argv[1], buildDependencyGraphReport, 'CODEX_DEPENDENCY_GRAPH_REPORT');
