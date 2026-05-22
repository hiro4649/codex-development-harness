#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readJsonLines(file) {
  if (!file || !fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  } catch {
    return text.split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }
}
const records = readJsonLines(argValue('--feedback') || process.env.CODEX_AUDIT_FEEDBACK_PATH || '');
const grouped = new Map();
for (const record of records) {
  const key = `${record.ruleId || 'unknown'}|${record.profile || 'generic'}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(record);
}
const suggestions = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => {
  const [ruleId, profile] = key.split('|');
  const falsePositive = items.filter((item) => item.wasFalsePositive === true).length;
  const missed = items.filter((item) => item.wasMissedRisk === true).length;
  return {
    ruleId,
    profile,
    currentSeverity: 'policy',
    suggestedSeverity: missed > falsePositive ? 'review_stricter' : (falsePositive ? 'review_less_strict' : 'no_change'),
    currentConfidence: 'policy',
    suggestedConfidence: missed > falsePositive ? 'review_higher' : (falsePositive ? 'review_lower' : 'no_change'),
    reason: 'derived from safe feedback counts',
    evidenceCount: items.length,
    humanReviewRequired: true,
    autoApply: false,
  };
});
if (process.env.CODEX_AUDIT_CALIBRATION_JSON === '1') process.stdout.write(`${JSON.stringify({ status: 'available', suggestions }, null, 2)}\n`);
else {
  console.log('== Codex audit calibration suggestions ==');
  console.log(`suggestionCount: ${suggestions.length}`);
  for (const item of suggestions.slice(0, 10)) console.log(`${item.ruleId}: ${item.suggestedSeverity} / ${item.suggestedConfidence} evidence=${item.evidenceCount}`);
  console.log('autoApply: false');
}
