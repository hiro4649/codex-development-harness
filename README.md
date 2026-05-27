<!-- CODEX_QUALITY_HARNESS_FILE v0.9.5 -->
# Codex Development Harness

Version: v0.9.5
Name: Agent Doctrine, Skill Routing, State Machine Evidence, and Minimal Evidence Gate

This repository contains reusable Codex quality gates, policies, and safe evidence tooling. v0.9.5 preserves v0.9.4 remote product context restore, product evidence lock, runtime job safety, tx path evidence, env consistency, and skip-npm bypass protection while adding AGENTS doctrine control, skill routing, skill load budget, skill drift detection, agent session governance, agent containment boundary checks, eval trace harvesting, operator-visible delta evidence, subagent governance, state machine schema evidence, state transition helper checks, receipt evidence schema, worker readiness sequence, evidence minimality, evidence dedup, safe artifact next-action classification, and skill evidence links.

The new checks use deterministic fixtures and safe summaries. They add no external dependency, no LLM judge requirement, no MCP requirement, no browser or Playwright requirement, no hidden chain-of-thought inspection, no product command execution, and no product code change requirement. AGENTS.md remains compact, and skills are selectively routed instead of loaded wholesale.

## What v0.9.5 Adds

- Agents Doctrine, Skill Routing, Skill Load Budget, and Skill Drift gates for keeping AGENTS.md compact while selecting only the needed skills.
- Agent Session Governance and Agent Containment Boundary gates for multi-agent state, branch ownership, tool permission, network, credential, and external-content boundaries.
- Eval Trace Harvest, Operator Visible Delta, Trace-to-Eval Candidate, Subagent Governance, and Subagent Review Matrix gates for safe review evidence without raw subagent output.
- State Machine Schema, State Transition Helper, Receipt Evidence Schema, and Worker Readiness Sequence gates for runtime and tx path evidence without claiming runtime readiness.
- Evidence Minimality, Evidence Dedup, Safe Artifact Next Action, and Skill Evidence Link gates for compact PR evidence and safe next actions.
- v0.9.5 deterministic self-test fixtures.

## Preserved v0.9.4 Capabilities

v0.9.5 keeps remote product context restore, product-relevant evidence lock, product baseline continuity, skip-npm product bypass protection, pull-request context fidelity, product-context safe artifact classification, runtime job safety, tx path state evidence, env consistency, staging no-tx preflight, runtime log secret scan, chain scope guard, false-positive budget tracking, target hotfix preservation, same-head artifact evidence, Docker smoke current-head artifact enforcement, and compact PR evidence.

## What v0.9.5 Does Not Add

No external memory server, MCP dependency, required LLM judge, GEPA or DSPy dependency, AST parser dependency, browser or Playwright requirement, external API call, prompt auto-apply, hidden chain-of-thought inspection, product command execution, product code changes, runtime readiness claim, production readiness claim, raw runtime log artifact, raw production trace artifact, or target rollout is implemented by this source update.

## Running The Core Gate

Node.js 20 or newer is expected. The harness core uses Node.js standard library scripts and does not require npm dependencies. If `package.json` is absent, npm checks are not real verification.

```bash
CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

Profiles remain v0.7.0-compatible optional artifacts unless a downstream propagation task explicitly updates them.

## Target Repositories

Target repository installs use `docs/process/CODEX_HARNESS_MANIFEST.json`. They must not copy or depend on `CODEX_SOURCE_HARNESS_MANIFEST.json`, which is only for this source harness repository.

Target mode is explicit:

```bash
CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
```

`CODEX_SKIP_NPM=1` remains valid for harness-only changes with no runtime readiness claim. Product source, tests, specs, package, lockfile, runtime asset, config, Docker, or script-entrypoint changes require the matching product or runtime evidence.
