<!-- CODEX_QUALITY_HARNESS_FILE v0.8.7 -->
# Codex Development Harness

Version: v0.8.7
Name: Eval-First Prompt, Review, Knowledge, and Contract Governance Gate

This repository contains reusable Codex quality gates, policies, and safe
evidence tooling. v0.8.7 preserves the v0.8.6 safety model while adding
eval-first governance for prompt-like files, skills, PR templates, review
policies, Code Review Monitor fixtures, repository knowledge maps, task
contracts, handoff artifacts, and load-bearing evidence. The new governance
checks use deterministic fixtures and safe summaries rather than raw prompt
dumping, raw diff storage, or heavy analysis.

## What v0.8.7 Adds

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

## What v0.8.7 Does Not Add

No external memory server, Agentmemory dependency, MCP dependency, SQLite memory
layer, automatic skill rewriting, automatic commit, automatic push, required LLM
judge, GEPA or DSPy dependency, self-evolving runtime, AST parser dependency,
browser or Playwright requirement, external API call, prompt auto-apply, or
product command execution is implemented by the new governance gates.

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
