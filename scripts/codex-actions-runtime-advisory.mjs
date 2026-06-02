#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function workflowText() {
  const dir = '.github/workflows';
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => fs.readFileSync(`${dir}/${name}`, 'utf8'))
    .join('\n');
}

export function buildActionsRuntimeAdvisoryReport(env = process.env) {
  const text = `${env.CODEX_ACTIONS_RUNTIME_ADVISORY_TEXT || ''}\n${workflowText()}`;
  const node20DeprecationSeen = /node\s*20.*deprecat|deprecat.*node\s*20/i.test(text);
  const forceNode24Configured = /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24|ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/i.test(text) ||
    env.FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 === 'true';
  const blocking = env.CODEX_ACTIONS_RUNTIME_DEPRECATION_BLOCKING === '1' && node20DeprecationSeen && !forceNode24Configured;
  const status = blocking ? 'fail' : node20DeprecationSeen ? 'warning' : 'pass';
  return simpleStatus('actionsRuntimeAdvisoryStatus', status, {
    node20DeprecationSeen,
    forceNode24Configured,
    nextAction: blocking ? 'configure_node24_or_update_actions' : node20DeprecationSeen ? 'track_actions_runtime_advisory' : 'none',
    reasonCodes: blocking ? ['actions_runtime_deprecation_blocked'] : node20DeprecationSeen ? ['actions_runtime_advisory_warning'] : [],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildActionsRuntimeAdvisoryReport();
    writeJsonReport(report, 'CODEX_ACTIONS_RUNTIME_ADVISORY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('actionsRuntimeAdvisoryStatus', 'fail', { reasonCodes: ['actions_runtime_advisory_warning'] });
    writeJsonReport(report, 'CODEX_ACTIONS_RUNTIME_ADVISORY_REPORT');
    process.exit(1);
  }
}
