#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_VERSION, marker, listFiles, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const traceDir = path.join('.codex', 'experience', 'traces');
const required = ['schemaVersion', 'eventId', 'timestamp', 'harnessVersion', 'eventType', 'riskLevel', 'commandClass', 'targetArea', 'result', 'safeSummary', 'unsafeContentRemoved', 'rawValuesStored'];

function buildReport() {
  if (!fs.existsSync(traceDir)) {
    return simpleStatus('safeTraceSchemaStatus', 'not_applicable', { reasonCodes: ['trace_not_enabled'] });
  }
  const files = listFiles(traceDir).filter((file) => file.endsWith('.jsonl'));
  if (!files.length) return simpleStatus('safeTraceSchemaStatus', 'not_applicable', { reasonCodes: ['trace_not_enabled'] });
  const reasonCodes = [];
  let eventCount = 0;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      eventCount += 1;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        reasonCodes.push('safe_trace_schema_invalid');
        continue;
      }
      for (const field of required) if (!(field in event)) reasonCodes.push('safe_trace_schema_invalid');
      if (event.rawValuesStored !== false) reasonCodes.push('safe_trace_unsafe_value');
      if (scanObjectForUnsafe(event).length) reasonCodes.push('safe_trace_unsafe_value');
    }
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('safeTraceSchemaStatus', status, { reasonCodes: [...new Set(reasonCodes)], eventCount });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_SAFE_TRACE_SCHEMA_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    safeTraceSchemaStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_SAFE_TRACE_SCHEMA_REPORT');
  process.exit(1);
}
