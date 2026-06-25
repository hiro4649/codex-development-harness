#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

const REQUIRED_SKILLS = ['tight-debug-loop', 'vertical-tdd', 'deep-module-design'];
const SKILL_ROOTS = ['docs/process/v130-skill-candidates', '.agents/skills'];

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function bytes(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (!match) return meta;
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return meta;
}

function yamlImplicitInvocationFalse(file) {
  const text = readText(file);
  return /allow_implicit_invocation:\s*false/.test(text);
}

export function compileV130Skills(options = {}) {
  const reasonCodes = [];
  const entries = [];
  for (const root of SKILL_ROOTS) {
    for (const name of REQUIRED_SKILLS) {
      const skillPath = path.join(root, name, 'SKILL.md').replace(/\\/g, '/');
      const yamlPath = path.join(root, name, 'agents', 'openai.yaml').replace(/\\/g, '/');
      if (!fs.existsSync(skillPath)) {
        reasonCodes.push(`v130_skill_missing_${name}`);
        continue;
      }
      if (!fs.existsSync(yamlPath)) reasonCodes.push(`v130_skill_openai_yaml_missing_${name}`);
      const text = readText(skillPath);
      const meta = parseFrontMatter(text);
      const skillBytes = bytes(text);
      const descriptionBytes = bytes(meta.description || '');
      const forbidden = /(human approval step|owner question step|creates merge authority|creates deploy authority|creates wallet authority|creates RPC authority|creates secret authority|raw log request|implicit invocation=true)/i.test(text);
      if (meta.name !== name) reasonCodes.push(`v130_skill_name_mismatch_${name}`);
      if (skillBytes > 3072) reasonCodes.push(`v130_skill_body_over_budget_${name}`);
      if (descriptionBytes > 180) reasonCodes.push(`v130_skill_description_over_budget_${name}`);
      if (forbidden) reasonCodes.push(`v130_skill_forbidden_authority_text_${name}`);
      if (fs.existsSync(yamlPath) && !yamlImplicitInvocationFalse(yamlPath)) reasonCodes.push(`v130_skill_implicit_invocation_not_false_${name}`);
      entries.push({
        name,
        version: '1.3.0',
        skillPath,
        openaiYamlPath: yamlPath,
        skillDigest: sha256(text),
        sourceClass: 'repo_trusted',
        authorizedTaskClasses: name === 'tight-debug-loop' ? ['bug_repair'] : name === 'vertical-tdd' ? ['code_change'] : ['architecture'],
        allowedRoles: name === 'deep-module-design' ? ['architecture_reviewer', 'independent_verifier'] : ['code_worker', 'independent_verifier'],
        allowedTools: name === 'deep-module-design' ? ['read', 'git', 'search'] : ['read', 'git', 'test', 'edit'],
        allowedPaths: [],
        referencePaths: [],
        completionCriteriaDigest: sha256(text.split('Completion criteria:')[1] || text),
        allowImplicitInvocation: false,
        authorityCreated: false,
        skillBytes,
        descriptionBytes,
      });
    }
  }
  const canonicalEntries = entries.sort((a, b) => `${a.skillPath}`.localeCompare(`${b.skillPath}`));
  const uniqueByName = new Map();
  for (const entry of canonicalEntries) {
    if (!uniqueByName.has(entry.name) || entry.skillPath.startsWith('.agents/skills/')) uniqueByName.set(entry.name, entry);
  }
  const catalogProjection = [...uniqueByName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, skillDigest, authorizedTaskClasses, allowImplicitInvocation, authorityCreated }) => ({
      n: name,
      d: skillDigest,
      t: authorizedTaskClasses[0],
      i: allowImplicitInvocation,
      a: authorityCreated,
    }));
  const catalogProjectionBytes = bytes(catalogProjection);
  const registry = {
    schemaVersion: '1.3.0',
    skillCount: canonicalEntries.length,
    requiredSkillNames: REQUIRED_SKILLS,
    entries: canonicalEntries,
    catalogProjection,
    catalogProjectionBytes,
    routineSelectedSkill: 0,
    authorityTaskSelectedSkill: 0,
    maxSelectedSkillPerTask: 1,
    authorityCreated: false,
  };
  registry.skillRegistryDigest = sha256(canonicalJson(registry));
  if (canonicalEntries.length !== REQUIRED_SKILLS.length * SKILL_ROOTS.length) reasonCodes.push('v130_skill_registry_count_mismatch');
  if (catalogProjectionBytes > 512) reasonCodes.push('v130_skill_catalog_projection_over_budget');
  if (options.expectActiveOnly === true && canonicalEntries.some((entry) => entry.skillPath.startsWith('docs/process/v130-skill-candidates/'))) {
    reasonCodes.push('v130_candidate_skill_path_still_active');
  }
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    registry,
    skillRegistryDigest: registry.skillRegistryDigest,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = compileV130Skills();
  console.log(canonicalJson(result));
  process.exit(result.status === 'pass' ? 0 : 1);
}
