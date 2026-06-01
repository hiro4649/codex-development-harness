#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_VERSION, marker, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const proposalPath = path.join('.codex', 'offline-evolution-proposal.json');
const required = ['targetFile', 'sourceSignals', 'candidateAction', 'expectedImprovement', 'constraints', 'goldenSetStatus', 'humanApprovalRequired'];

function buildReport() {
  if (!fs.existsSync(proposalPath)) {
    return simpleStatus('offlineEvolutionProposalStatus', 'not_applicable', { reasonCodes: ['offline_evolution_not_enabled'] });
  }
  const parsed = readJson(proposalPath);
  const reasonCodes = [];
  if (!parsed.ok) reasonCodes.push('offline_evolution_proposal_invalid');
  else {
    const proposal = parsed.value;
    for (const field of required) if (!(field in proposal)) reasonCodes.push('offline_evolution_proposal_invalid');
    if (proposal.autoApply === true || proposal.autoCommit === true || proposal.autoPush === true) reasonCodes.push('offline_evolution_auto_apply_forbidden');
    if (proposal.humanApprovalRequired !== true) reasonCodes.push('offline_evolution_proposal_invalid');
    if (scanObjectForUnsafe(proposal).length) reasonCodes.push('offline_evolution_proposal_invalid');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('offlineEvolutionProposalStatus', status, { reasonCodes: [...new Set(reasonCodes)] });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_OFFLINE_EVOLUTION_PROPOSAL_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    offlineEvolutionProposalStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_OFFLINE_EVOLUTION_PROPOSAL_REPORT');
  process.exit(1);
}
