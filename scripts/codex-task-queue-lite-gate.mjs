#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_VERSION, marker, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const queuePath = path.join('.codex', 'task-queue.json');

function buildReport() {
  if (!fs.existsSync(queuePath)) {
    return simpleStatus('taskQueueLiteStatus', 'not_applicable', { reasonCodes: ['task_queue_not_enabled'] });
  }
  const parsed = readJson(queuePath);
  const reasonCodes = [];
  if (!parsed.ok) reasonCodes.push('task_queue_invalid');
  else {
    const tasks = Array.isArray(parsed.value?.tasks) ? parsed.value.tasks : Array.isArray(parsed.value) ? parsed.value : [];
    if (!tasks.length) reasonCodes.push('task_queue_invalid');
    for (const task of tasks) {
      for (const field of ['taskId', 'title', 'status', 'riskLevel', 'safeSummary', 'nextAction']) {
        if (!(field in task)) reasonCodes.push('task_queue_invalid');
      }
    }
    if (scanObjectForUnsafe(parsed.value).length) reasonCodes.push('task_queue_unsafe');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('taskQueueLiteStatus', status, { reasonCodes: [...new Set(reasonCodes)] });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_TASK_QUEUE_LITE_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    taskQueueLiteStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_TASK_QUEUE_LITE_REPORT');
  process.exit(1);
}
