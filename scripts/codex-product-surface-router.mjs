#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV103GateCli, buildProductSurfaceRouterReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildProductSurfaceRouterReport, 'CODEX_PRODUCT_SURFACE_ROUTER_REPORT');
