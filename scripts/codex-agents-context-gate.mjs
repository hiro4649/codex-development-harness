#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.0
import {
  HARNESS_VERSION,
  marker,
  readText,
  mojibakeFindings,
  concreteUnsafeFindings,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const requiredPhrases = [
  /source harness boundary/i,
  /plan-first/i,
  /safe output/i,
  /merge-ready claim/i,
  /manual confirmation/i,
  /profile\/core separation/i,
];

function storedUnsafeContentFindings(text) {
  const findings = [];
  const safePolicyContext = /\b(do not|must not|never|forbidden|avoid|safe output|policy|rule|cannot|no raw)\b/i;
  const unsafeStoredContent = /\b(raw logs?|raw diffs?|raw payloads?|production data|personal data)\s*:/i;
  String(text || '').split(/\r?\n/).forEach((line) => {
    if (!unsafeStoredContent.test(line)) return;
    if (safePolicyContext.test(line)) return;
    findings.push('agents_context_unsafe_value');
  });
  return findings;
}

function buildReport() {
  const text = readText('AGENTS.md');
  const reasonCodes = [];
  if (text === null) reasonCodes.push('agents_context_missing');
  else {
    reasonCodes.push(...mojibakeFindings(text));
    if (concreteUnsafeFindings(text, 'AGENTS.md').length) reasonCodes.push('agents_context_unsafe_value');
    reasonCodes.push(...storedUnsafeContentFindings(text));
    for (const pattern of requiredPhrases) {
      if (!pattern.test(text)) reasonCodes.push('agents_context_required_section_missing');
    }
    if (text.length > 8000) reasonCodes.push('agents_context_too_long');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('agentsContextStatus', status, {
    reasonCodes: [...new Set(reasonCodes)],
    utf8Readable: text !== null,
  });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_AGENTS_CONTEXT_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    agentsContextStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_AGENTS_CONTEXT_REPORT');
  process.exit(1);
}
