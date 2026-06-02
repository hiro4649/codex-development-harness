#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
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

function harnessBlocks(text) {
  return String(text || '').match(/CODEX_QUALITY_HARNESS_BEGIN[\s\S]*?CODEX_QUALITY_HARNESS_END/g) || [];
}

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
  let harnessBlockCount = 0;
  let currentHarnessBlockPresent = false;
  let unsafeFindingsCount = 0;
  let mojibakeDetected = false;
  if (text === null) reasonCodes.push('agents_context_missing');
  else {
    const blocks = harnessBlocks(text);
    harnessBlockCount = blocks.length;
    currentHarnessBlockPresent = blocks.some((block) => block.includes(marker));
    const mojibake = mojibakeFindings(text);
    mojibakeDetected = mojibake.length > 0;
    if (mojibakeDetected) reasonCodes.push('agents_context_entire_file_mojibake');
    const unsafe = concreteUnsafeFindings(text, 'AGENTS.md');
    unsafeFindingsCount = unsafe.length;
    if (unsafeFindingsCount) reasonCodes.push('agents_context_unsafe_value');
    reasonCodes.push(...storedUnsafeContentFindings(text));
    if (harnessBlockCount !== 1) reasonCodes.push(harnessBlockCount === 0 ? 'agents_context_missing_harness_block' : 'agents_context_duplicate_harness_block');
    if (!currentHarnessBlockPresent) reasonCodes.push('agents_context_missing_harness_block');
    for (const pattern of requiredPhrases) {
      if (!pattern.test(text)) reasonCodes.push('agents_context_required_section_missing');
    }
    if (text.length > 8000) reasonCodes.push('agents_context_too_long');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('agentsContextStatus', status, {
    reasonCodes: [...new Set(reasonCodes)],
    utf8Readable: text !== null,
    mojibakeDetected,
    harnessBlockCount,
    currentHarnessBlockPresent,
    unsafeFindingsCount,
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
