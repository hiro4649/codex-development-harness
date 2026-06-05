#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const HARNESS_VERSION = '1.0.1';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const defaultPolicy = {
  requiredPrSections: [
    'Goal',
    'Context',
    'Constraints',
    'Done when',
    'Files or scope',
    'Plan-first status',
    'Environment setup',
    'Testing and review',
    'Residual risks',
    'Best of N used or skipped',
    'Code review status',
    'Human confirmation needed',
  ],
  minimumSectionChars: 12,
  planFirstRequiredFor: [
    'R3',
    'implementation',
    'dependency',
    'security',
    'release',
    'migration',
    'refactor',
    'multi-file',
    'large-diff',
  ],
  thresholds: {
    largeDiffFiles: 8,
    largeDiffLines: 300,
  },
  bestOfNRecommendedFor: [
    'architecture',
    'ambiguous',
    'risky',
    'migration',
  ],
};

const managedPaths = {
  policyMd: path.join('docs', 'process', 'CODEX_OPENAI_CODEX_METHOD_POLICY.md'),
  policyJson: path.join('docs', 'process', 'CODEX_OPENAI_CODEX_METHOD_POLICY.json'),
  codeReview: path.join('docs', 'process', 'code_review.md'),
  taskBrief: path.join('docs', 'process', 'CODEX_TASK_BRIEF_TEMPLATE.md'),
  planTemplate: path.join('docs', 'process', 'CODEX_PLAN_TEMPLATE.md'),
  prTemplate: path.join('.github', 'pull_request_template.md'),
  agents: 'AGENTS.md',
};

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function readJson(file) {
  const text = readText(file);
  if (text === null) return null;
  return JSON.parse(text);
}

function readPrBody() {
  if (process.env.CODEX_PR_BODY && process.env.CODEX_PR_BODY.trim()) {
    return { body: process.env.CODEX_PR_BODY, prContext: true, source: 'CODEX_PR_BODY' };
  }

  if (process.env.CODEX_PR_BODY_PATH) {
    const body = readText(process.env.CODEX_PR_BODY_PATH);
    if (body !== null) return { body, prContext: true, source: 'CODEX_PR_BODY_PATH' };
  }

  if (process.env.GITHUB_EVENT_PATH) {
    const eventText = readText(process.env.GITHUB_EVENT_PATH);
    if (eventText) {
      try {
        const event = JSON.parse(eventText);
        if (event.pull_request) {
          return {
            body: event.pull_request.body || '',
            prContext: true,
            source: 'GITHUB_EVENT_PATH',
          };
        }
      } catch {
        return { body: '', prContext: true, source: 'GITHUB_EVENT_PATH', eventReadError: true };
      }
    }
  }

  const envPrContext = Boolean(process.env.GITHUB_REF && process.env.GITHUB_REF.includes('/pull/')) ||
    Boolean(process.env.CODEX_PR_NUMBER);

  return { body: '', prContext: envPrContext, source: 'none' };
}

function normalize(value) {
  return value.toLowerCase().replace(/[`*_#:[\]-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function canonicalSectionName(value, requiredSections) {
  const aliases = new Map();
  for (const section of requiredSections) aliases.set(normalize(section), section);
  aliases.set('done', 'Done when');
  aliases.set('files scope', 'Files or scope');
  aliases.set('scope', 'Files or scope');
  aliases.set('plan first', 'Plan-first status');
  aliases.set('plan first status', 'Plan-first status');
  aliases.set('environment', 'Environment setup');
  aliases.set('environment setup', 'Environment setup');
  aliases.set('testing review', 'Testing and review');
  aliases.set('testing and review', 'Testing and review');
  aliases.set('review testing', 'Testing and review');
  aliases.set('risks', 'Residual risks');
  aliases.set('residual risks', 'Residual risks');
  aliases.set('best of n', 'Best of N used or skipped');
  aliases.set('best of n evidence', 'Best of N used or skipped');
  aliases.set('best of n used or skipped', 'Best of N used or skipped');
  aliases.set('code review', 'Code review status');
  aliases.set('code review status', 'Code review status');
  aliases.set('human confirmation', 'Human confirmation needed');
  aliases.set('human confirmation needed', 'Human confirmation needed');
  return aliases.get(normalize(value)) || null;
}

function parseSections(body, requiredSections) {
  const lines = body.split(/\r?\n/);
  const sections = new Map();
  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const labelMatch = line.match(/^\s{0,3}([A-Za-z][A-Za-z0-9 /-]{1,60})\s*:\s*(.*)$/);
    let next = null;
    let initial = '';

    if (headingMatch) {
      next = canonicalSectionName(headingMatch[1], requiredSections);
    } else if (labelMatch) {
      next = canonicalSectionName(labelMatch[1], requiredSections);
      initial = labelMatch[2] || '';
    }

    if (next) {
      current = next;
      if (!sections.has(current)) sections.set(current, []);
      if (initial.trim()) sections.get(current).push(initial);
      continue;
    }

    if (current) sections.get(current).push(line);
  }

  const parsed = {};
  for (const section of requiredSections) {
    parsed[section] = (sections.get(section) || []).join('\n').trim();
  }
  return parsed;
}

function placeholderOnly(value) {
  const compact = value.replace(/[\s*`_>-]+/g, ' ').trim().toLowerCase();
  if (!compact) return true;
  if (/^(todo|tbd|n\/a|na|none|placeholder|fill me|fill this|coming soon|later)$/.test(compact)) return true;
  if (/^(todo|tbd|placeholder)\b/.test(compact) && compact.length < 24) return true;
  return false;
}

function allowedPublicUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'github.com' || host === 'docs.github.com' || host.endsWith('.github.com')) return true;
    if (host === 'developers.openai.com' || host === 'openai.com' || host === 'cdn.openai.com') return true;
    return false;
  } catch {
    return false;
  }
}

function unsafeUrlLabels(label, text) {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  const urlPattern = /\b(?:https?|postgres(?:ql)?|mysql|mongodb|file):\/\/[^\s<>"'`]+/gi;
  const envUrlAssignment = /\b[A-Z0-9_]*(?:URL|URI|ENDPOINT|RPC)[A-Z0-9_]*\s*=\s*["']?(?:https?|postgres(?:ql)?|mysql|mongodb):\/\//i;

  for (const line of lines) {
    const urls = line.match(urlPattern) || [];
    if (envUrlAssignment.test(line)) findings.push(`${label}:env_url_assignment_like`);

    for (const rawUrl of urls) {
      if (/^(?:postgres(?:ql)?|mysql|mongodb):\/\//i.test(rawUrl)) {
        findings.push(`${label}:database_url_like`);
        continue;
      }
      if (/^file:\/\/\/?(?:[a-z]:\/users\/|\/home\/)/i.test(rawUrl)) {
        findings.push(`${label}:private_path_url_like`);
        continue;
      }
      if (allowedPublicUrl(rawUrl)) continue;
      if (/^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/i.test(rawUrl)) {
        findings.push(`${label}:credentialed_url_like`);
        continue;
      }

      let parsed = null;
      try {
        parsed = new URL(rawUrl);
      } catch {
        findings.push(`${label}:malformed_url_like`);
        continue;
      }

      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        /^127\./.test(host) ||
        host.endsWith('.internal') ||
        host.endsWith('.local') ||
        (!host.includes('.') && !['github.com', 'openai.com'].includes(host))
      ) {
        findings.push(`${label}:internal_url_like`);
        continue;
      }
      if (/(?:^|[?&])(token|key|secret|password)=/i.test(parsed.search)) {
        findings.push(`${label}:secret_query_url_like`);
        continue;
      }
      if (/\b(?:production|prod|endpoint|rpc|database|db|secret|token|key)\b/i.test(line)) {
        findings.push(`${label}:production_endpoint_line_like`);
      }
    }
  }

  return [...new Set(findings)];
}

function unsafeLabels(label, text, options = {}) {
  if (!text) return [];
  const findings = [];
  const rules = [
    ['raw_diff_like', /^diff --git\s|^@@\s/m],
    ['private_key_like', /-----BEGIN [^-]+PRIVATE KEY-----/i],
    ['github_token_like', /\bgh[pousr]_[A-Za-z0-9_-]{8,}\b/],
    ['openai_key_like', /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ['aws_key_like', /\bAKIA[0-9A-Z]{16}\b/],
    ['jwt_like', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['private_path_like', /\b[A-Za-z]:\\Users\\[^"'`\s]+|\/home\/[^"'`\s]+/i],
  ];

  for (const [name, pattern] of rules) {
    if (pattern.test(text)) findings.push(`${label}:${name}`);
  }

  findings.push(...unsafeUrlLabels(label, text));

  if (!options.allowForbiddenLabels) {
    const forbiddenLabels = [
      ['raw_diff_label', /\brawDiff\b/i],
      ['raw_logs_label', /\brawLogs\b/i],
      ['secret_value_label', /\bsecretValue\b/i],
      ['endpoint_value_label', /\bendpointValue\b/i],
      ['private_path_label', /\bprivatePath\b/i],
      ['payload_label', /\bpayload\b/i],
    ];
    for (const [name, pattern] of forbiddenLabels) {
      if (pattern.test(text)) findings.push(`${label}:${name}`);
    }
  }

  return findings;
}

function gitChangedStats() {
  try {
    const files = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean);

    const rows = execSync('git diff --numstat origin/main...HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean);

    let changedLines = 0;
    for (const row of rows) {
      const [added, removed] = row.split(/\s+/);
      changedLines += (Number(added) || 0) + (Number(removed) || 0);
    }
    return { fileCount: files.length, changedLines };
  } catch {
    return { fileCount: 0, changedLines: 0 };
  }
}

function inspectSupportFiles(policy) {
  const status = {};
  const failures = [];
  const shapeRules = {
    policyMd: [/Required Task Shape/i, /CI must not mark a pull request merge-ready/i],
    policyJson: [/"requiredPrSections"/, /"manualConfirmationCannotOverride"/],
    codeReview: [/Correctness:/i, /Method compliance:/i, /Evidence:/i],
    taskBrief: [/Goal:/i, /Context:/i, /Residual risks:/i],
    planTemplate: [/Goal restatement:/i, /Tests to run:/i, /Stop conditions:/i],
    prTemplate: [/Codex Method Compliance/i, /Code review status:/i],
    agents: [/CODEX_OPENAI_CODEX_METHOD_POLICY\.md|code_review\.md/i],
  };
  for (const [key, file] of Object.entries(managedPaths)) {
    const text = readText(file);
    status[key] = text === null ? 'missing' : 'present';
    if (text === null) failures.push(`${key}=missing`);
    else {
      if (!text.includes(marker)) failures.push(`${key}=marker_missing`);
      const rules = shapeRules[key] || [];
      for (const rule of rules) {
        if (!rule.test(text)) failures.push(`${key}=shape_mismatch`);
      }
    }
  }

  const prTemplate = readText(managedPaths.prTemplate) || '';
  if (!/Codex Method Compliance/i.test(prTemplate)) {
    status.prTemplate = 'missing_method_section';
    failures.push('prTemplate=missing_method_section');
  }

  const agents = readText(managedPaths.agents) || '';
  if (!/code_review\.md|CODEX_OPENAI_CODEX_METHOD_POLICY\.md/i.test(agents)) {
    status.agents = 'missing_method_reference';
    failures.push('agents=missing_method_reference');
  }

  const policyMd = readText(managedPaths.policyMd) || '';
  const policyJsonText = readText(managedPaths.policyJson) || '';
  for (const finding of unsafeLabels('policy', `${policyMd}\n${policyJsonText}`, { allowForbiddenLabels: true })) {
    failures.push(`unsafeOutput=${finding}`);
  }

  if (policy.marker !== marker) failures.push('policyJson=marker_mismatch');
  return {
    status: failures.length ? 'fail' : 'pass',
    files: status,
    failures,
  };
}

function detectPlanFirstNeed(body, policy) {
  const lower = body.toLowerCase();
  const stats = gitChangedStats();
  const triggers = [];

  for (const item of policy.planFirstRequiredFor || defaultPolicy.planFirstRequiredFor) {
    const needle = item.toLowerCase();
    if (needle === 'large-diff') continue;
    if (lower.includes(needle)) triggers.push(item);
  }

  if (stats.fileCount > 1) triggers.push('multi-file');
  if (stats.fileCount >= (policy.thresholds?.largeDiffFiles || defaultPolicy.thresholds.largeDiffFiles)) {
    triggers.push('large-diff-files');
  }
  if (stats.changedLines >= (policy.thresholds?.largeDiffLines || defaultPolicy.thresholds.largeDiffLines)) {
    triggers.push('large-diff-lines');
  }

  return { required: triggers.length > 0, triggers: [...new Set(triggers)], stats };
}

function validateExplicitSection(section, value) {
  const compact = value.replace(/[\s*`_>-]+/g, ' ').trim().toLowerCase();
  if (placeholderOnly(value)) return `${section}=weak`;

  if (section === 'Code review status') {
    if (/^(not run|not-run|unreviewed|none|n\/a|na)$/.test(compact)) return 'Code review status=not_run';
    if (
      /\bself reviewed\b/.test(compact) ||
      /\breviewed\b/.test(compact) ||
      /\bmanual(?:ly)?\b/.test(compact) ||
      /docs\/process\/code_review\.md/.test(compact) ||
      /not required with reason|not-required-with-reason/.test(compact)
    ) return null;
    return 'Code review status=missing_evidence';
  }

  if (section === 'Human confirmation needed') {
    if (/\b(yes|no|required|manual confirmation|not required with reason|not-required-with-reason)\b/.test(compact)) return null;
    return 'Human confirmation needed=missing_decision';
  }

  if (section === 'Best of N used or skipped') {
    if (/\b(used|compared)\b/.test(compact)) return null;
    if (/candidate count/.test(compact) && /selected candidate/.test(compact)) return null;
    if (/skipped/.test(compact) && /\b(reason|because|not applicable|not required with reason|not-required-with-reason)\b/.test(compact)) return null;
    return 'Best of N used or skipped=missing_reason';
  }

  return null;
}

function buildReport() {
  const warnings = [];
  const failures = [];
  let policy = { ...defaultPolicy };

  try {
    policy = { ...defaultPolicy, ...(readJson(managedPaths.policyJson) || {}) };
  } catch {
    failures.push('policyJson=parse_failed');
  }

  const bodyInfo = readPrBody();
  const requireGate = process.env.CODEX_REQUIRE_OPENAI_METHOD_GATE === '1';
  const support = inspectSupportFiles(policy);
  failures.push(...support.failures);
  const requiredSections = policy.requiredPrSections || defaultPolicy.requiredPrSections;
  if (!bodyInfo.body.trim()) {
    if (requireGate || bodyInfo.prContext) failures.push('prBody=missing');
    else {
      const status = support.status === 'fail' ? 'fail' : 'not_applicable';
      return {
        marker,
        harnessVersion: HARNESS_VERSION,
        status,
        requiredSections,
        missingSections: [],
        weakSections: [],
        planFirst: { required: false, status: 'not_applicable', triggers: [] },
        prTemplateStatus: { status: support.files.prTemplate === 'missing_method_section' ? 'fail' : support.files.prTemplate || 'missing' },
        codeReviewStatus: { status: support.files.codeReview || 'missing', path: managedPaths.codeReview },
        policyStatus: { status: support.failures.some((item) => item.startsWith('policyJson=')) ? 'fail' : 'pass', path: managedPaths.policyJson },
        methodSupportStatus: support,
        unsafeOutputStatus: { status: support.failures.some((item) => item.startsWith('unsafeOutput=')) ? 'fail' : 'pass' },
        warnings,
        failures,
        safeSummary: status === 'fail'
          ? 'OpenAI Codex Method Gate support files failed; see safe labels.'
          : 'No pull request body was available; method gate is not applicable for local non-PR execution.',
      };
    }
  }

  const sections = parseSections(bodyInfo.body, requiredSections);
  const missingSections = [];
  const weakSections = [];

  for (const section of requiredSections) {
    const value = sections[section] || '';
    if (!value.trim()) missingSections.push(section);
    else if (placeholderOnly(value) || value.length < (policy.minimumSectionChars || 12)) weakSections.push(section);
  }

  for (const section of missingSections) failures.push(`sectionMissing=${section}`);
  for (const section of weakSections) failures.push(`sectionWeak=${section}`);
  for (const section of ['Best of N used or skipped', 'Code review status', 'Human confirmation needed']) {
    const finding = validateExplicitSection(section, sections[section] || '');
    if (finding) failures.push(`sectionInvalid=${finding}`);
  }

  const unsafeFindings = unsafeLabels('prBody', bodyInfo.body);
  for (const finding of unsafeFindings) failures.push(`unsafeOutput=${finding}`);

  const planFirst = detectPlanFirstNeed(bodyInfo.body, policy);
  const planText = sections['Plan-first status'] || '';
  const planLower = planText.toLowerCase();
  let planStatus = 'not_required';

  if (planFirst.required) {
    if (/\b(done|reviewed|approved)\b/.test(planLower) || /not-required-with-reason/.test(planLower)) {
      planStatus = 'pass';
    } else if (/\bnot\s+required\b/.test(planLower)) {
      planStatus = 'fail_not_required_without_reason';
    } else {
      planStatus = 'fail_missing_evidence';
    }
    if (planStatus !== 'pass') failures.push(`planFirst=${planStatus}`);
  }

  const lowerBody = bodyInfo.body.toLowerCase();
  const bestOfNeedles = policy.bestOfNRecommendedFor || defaultPolicy.bestOfNRecommendedFor;
  if (bestOfNeedles.some((item) => lowerBody.includes(item.toLowerCase())) && !/best\s+of\s+n/i.test(bodyInfo.body)) {
    warnings.push('bestOfN=recommended');
  }

  const status = failures.length ? 'fail' : warnings.length ? 'warning' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    status,
    requiredSections: requiredSections.map((section) => ({
      name: section,
      status: missingSections.includes(section) ? 'missing' : weakSections.includes(section) ? 'weak' : 'pass',
    })),
    missingSections,
    weakSections,
    planFirst: { ...planFirst, status: planStatus },
    prTemplateStatus: { status: support.files.prTemplate === 'missing_method_section' ? 'fail' : support.files.prTemplate || 'missing' },
    codeReviewStatus: { status: support.files.codeReview || 'missing', path: managedPaths.codeReview },
    policyStatus: { status: failures.some((item) => item.startsWith('policyJson=')) ? 'fail' : 'pass', path: managedPaths.policyJson },
    methodSupportStatus: support,
    unsafeOutputStatus: { status: unsafeFindings.length ? 'fail' : 'pass', labels: unsafeFindings },
    warnings,
    failures,
    safeSummary: status === 'pass'
      ? 'OpenAI Codex Method Gate passed.'
      : status === 'warning'
        ? 'OpenAI Codex Method Gate passed with human-review warnings.'
        : 'OpenAI Codex Method Gate failed; see safe labels.',
  };
}

function printReport(report) {
  if (process.env.CODEX_OPENAI_METHOD_REPORT === 'json') {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log(`OpenAI Codex Method Gate: ${report.status}`);
  console.log(report.safeSummary);
  if (report.missingSections?.length) console.log(`missingSections: ${report.missingSections.join(', ')}`);
  if (report.weakSections?.length) console.log(`weakSections: ${report.weakSections.join(', ')}`);
  if (report.warnings?.length) console.log(`warnings: ${report.warnings.join(', ')}`);
  if (report.failures?.length) console.log(`failures: ${report.failures.join(', ')}`);
}

try {
  const report = buildReport();
  printReport(report);
  process.exit(report.status === 'fail' ? 1 : 0);
} catch {
  printReport({
    marker,
    harnessVersion: HARNESS_VERSION,
    status: 'fail',
    requiredSections: defaultPolicy.requiredPrSections,
    missingSections: [],
    weakSections: [],
    planFirst: { required: false, status: 'error', triggers: [] },
    prTemplateStatus: { status: 'unknown' },
    codeReviewStatus: { status: 'unknown' },
    policyStatus: { status: 'unknown' },
    methodSupportStatus: { status: 'unknown' },
    unsafeOutputStatus: { status: 'unknown' },
    warnings: [],
    failures: ['methodGate=unexpected_error'],
    safeSummary: 'OpenAI Codex Method Gate failed with an internal error.',
  });
  process.exit(1);
}
