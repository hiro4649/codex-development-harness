<!-- CODEX_QUALITY_HARNESS_FILE v0.8.9 -->
# Codex Development Harness

Version: v0.8.9
Name: Evidence Continuity, Baseline Health, and Operational Precision Gate

This repository contains reusable Codex quality gates, policies, and safe
evidence tooling. v0.8.9 preserves the v0.8.8 safety model while improving
npm/product baseline health, remote evidence continuity, PR body surface
normalization, self-test failure diagnostics, score decomposition, old marker
detection, and harness-only CI profile control. The new checks use deterministic
fixtures and safe summaries rather than hidden chain-of-thought inspection, raw
diff storage, browser-required gates, MCP, LLM judges, network calls, or product
command execution added by the new gates.

## What v0.8.9 Adds

- Generic core mode: `CODEX_HARNESS_MODE=core`
- Optional profile compatibility: `CODEX_PROFILE_COMPAT_MODE=optional`
- AGENTS context integrity validation across the whole file
- Environment readiness validation
- Golden set regression fixtures
- Target change classification
- Product verification policy for `CODEX_SKIP_NPM`
- Workflow quality runner for GitHub Actions safe artifacts
- Policy-driven change classification rules
- Normalized product verification evidence
- Remote product baseline gate for product-relevant PRs
- Remote npm diagnostic classifier using safe metadata only
- Workflow preflight runner
- Harness fast path gate for safe harness/docs changes
- Diagnostic consolidation runner
- Unsafe value class action matrix
- Invalid report recovery v2
- Safe artifact index with budget and primary human artifacts
- PR body profile optimizer
- Open PR hygiene report v2
- GitHub Actions runtime advisory
- Execution stability gate for task mode and bugfix evidence
- Code Review Monitor Gate for lightweight correctness, regression, security,
  data integrity, runtime safety, test evidence, and diff-scope checks
- Prompt Governance Gate for deterministic eval-first checks of prompt-like
  files, skills, PR templates, and review policies
- Review Eval Suite for fixed Code Review Monitor regression fixtures
- Knowledge Governance Gate and knowledge map for source-of-record indexing
- Contract Governance Gate for task contracts, handoff safety, and load-bearing
  evidence on risky harness changes
- Complexity Governance Gate for low/medium/high task classification,
  surface-specific oracle requirements, solvability checks, execution interface
  availability, split requirements, and algorithmic artifact preference
- Baseline Health Gate to keep product baseline and npm diagnostic paths from
  bypassing product verification
- Evidence Continuity Gate to protect baseline, product verification, evidence
  pack, human confirmation, complexity oracle, self-test case export, and score
  decomposition paths
- PR Body Surface Normalizer to reduce false positives from negated or
  forbidden-scope auth, runtime, and storage mentions
- Self-test case export for safe failed case IDs without raw logs or fixtures
- Score decomposition and old harness marker detection
- Harness-only self-test profile control that cannot bypass product-relevant
  verification
- Prompt variant suggestion-only report with `autoApply`, `autoCommit`, and
  `autoPush` fixed false
- `codex-bugfix` skill for focused bugfix work
- Optional import smoke micro-checks when target repos explicitly configure them
- Optional runtime risk register checks for readiness or release claims
- Fast path explainability fields
- Product verification failure explanation without changing product gate results
- One-screen source and target final summaries
- Optional safe test metrics artifacts
- Stale PR audit checks
- Compact failure reason summaries
- Target quality score
- Practical Best of N evidence checks
- Optional task queue lite validation
- Optional safe trace schema validation
- Report-only curator and offline evolution proposal gates
- Test coverage evidence and performance evidence gates when claims require them

## What v0.8.9 Does Not Add

No external memory server, Agentmemory dependency, MCP dependency, SQLite memory
layer, automatic skill rewriting, automatic commit, automatic push, required LLM
judge, GEPA or DSPy dependency, self-evolving runtime, AST parser dependency,
browser or Playwright requirement, external API call, prompt auto-apply, hidden
chain-of-thought inspection, or product command execution is implemented by the
new governance gates.

## Running The Core Gate

Node.js 20 or newer is expected. The harness core uses Node.js standard library
scripts and does not require npm dependencies. If `package.json` is absent, npm
checks are not real verification.

```bash
CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

Profiles remain v0.7.0-compatible optional artifacts unless a downstream
propagation task explicitly updates them.

## Target Repositories

Target repository installs use `docs/process/CODEX_HARNESS_MANIFEST.json`.
They must not copy or depend on `CODEX_SOURCE_HARNESS_MANIFEST.json`, which is
only for this source harness repository.

Target mode is explicit:

```bash
CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

`CODEX_SKIP_NPM=1` remains valid for harness-only changes with no runtime
readiness claim. Product source, tests, specs, package, lockfile, runtime asset,
or config changes require product verification evidence.
