#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV102GateCli, buildBackupArtifactManagerReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildBackupArtifactManagerReport, 'CODEX_BACKUP_ARTIFACT_MANAGER_REPORT');
