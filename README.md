<!-- CODEX_QUALITY_HARNESS_FILE v1.2.7 -->
# Codex Development Harness

Version: v1.2.7
Name: Receipt-Carried Continuation and Evidence Compression

Codex Development Harness is an AI PR safety gate. It helps decide whether an
AI-authored change can be trusted, what evidence supports that decision, who is
allowed to approve it, and where the work must stop.

Current authority is:

- `AGENTS.md`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_V127_SPEC.md`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`

v1.2.7 keeps v1.1.8 Final Decision as final authority and preserves v1.1.9
orchestration/proof artifacts plus v1.2.0-v1.2.6 compatibility. It adds only
internal typed owner process receipts, continuation decisions, decision
evidence envelopes, validation evidence reuse, token economy, and blocker
closure semantics inside existing harness surfaces.

It does not add target rollout authority, new P0 artifacts, new top-level
operator statuses, new Skills, scheduler authority, release/deploy/wallet/RPC
authority, readiness authority, legal/YouTube policy compliance authority, or
GitHub approval review authority. When an owner explicitly instructs Source
HARNESS development and GitHub publication, scoped commit, push, and PR
creation are continuation actions and should not create avoidable owner stops.

## Quickstart

Node.js 20 or newer is expected. The source harness local gate is:

~~~bash
CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
~~~

Target repository installs use target mode:

~~~bash
CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs
~~~

The operator-facing result should compress to one verdict, one primary blocker,
and one safe next action. Raw logs, secrets, hidden reasoning, self-approval,
GitHub approval review, deploy, wallet/RPC access, readiness claims, legal
claims, and YouTube policy compliance claims are outside this harness authority.

## Product Position

Flue runs agents. This harness verifies AI-authored changes. The intended
product surface is an AI PR safety gate: same-head evidence, safe artifacts,
owner receipt, checker/builder separation, policy profiles, and bounded failure
handoff before a PR is treated as merge-ready.

Harness `skillProfiles` are machine-readable harness/profile identifiers. They
are not OpenAI Codex Skills and should not be renamed in this pass.

Historical material below is preserved as migration history, not as the current
operating version.

v1.0.3 preserves v1.0.2 clean-main, fixture isolation, product PR recovery, external blocked separation, handover snapshot, protected state, and workflow resume.

v1.0.3 adds final aggregation consistency, remote npm truth, product surface routing, active self-test artifact source, PR body governance auto-repair, review evidence taxonomy, contract readiness profile, stale input freshness, 5.5 low mode, and Dynamic Workflow Lite.

v1.0.4 adds deterministic distrust-by-default gates that cross-check PR claims, code references, acceptance criteria, risk register state, safe evidence, GitHub state freshness, tool gaps, target hotfix preservation, PR-chain saturation, role-bound tool policy, evidence site governance, annotation governance, and Dynamic Workflow Lite contracts before completion or merge readiness can be claimed.

## What v1.0.4 Adds

- Claim-to-code verification, claim extraction, claim coverage, contradiction detection, evidence source checks, and safe suggested checks.
- Architecture boundary linting for repository internals, UI secret boundaries, wallet privacy, YouTube crypto claims, candidate execution shortcuts, and runtime/production readiness escalation.
- Acceptance criteria matrix, risk gate, evidence report v2, GitHub state hysteresis, tool gap resolver, product surface router v2, diagnostic source fields, and active self-test single-source gates.
- Target hotfix preservation replay, PR-chain saturation, external blocked terminal state, role/tool/evidence site/annotation governance, and Dynamic Workflow Lite work-packet governance.
- v104 self-test as the active suite while v103 and v102 remain preserved legacy/advisory suites.

## What v1.0.3 Adds

- Final aggregation, local/remote failure delta, merge-readiness reason ladder, and safe-next-action precision gates.
- Remote npm diagnostic truth, product surface routing, active self-test artifact source, and PR body governance auto-repair gates.
- Review evidence taxonomy, contract readiness profile, stale audit input freshness, GitHub event payload freshness, live PR body freshness, and safe artifact head-match gates.
- 5.5 low mode constraints and Dynamic Workflow Lite fixtures for work packets, approval gates, simulated subagent fallback, adversarial review, and verification fan-in.
- P1 domain roadmap fixtures for FUNKY runtime adoption, receipt fetcher no-secret preflight, staging no-tx evidence, safe row export, dataset audit v2, Game/Tool Adapter fixture packs, beloved avatar safety audit specs, and VGC-FUNKY release ladder.

## What v1.0.2 Adds

v1.0.2 preserves v1.0.1 local gate contract, branch/head invariant, side-effect guard, outcome contract, anti-accretion, visible acceptance evidence, and runtime/production readiness boundaries.

v1.0.2 adds clean-main baseline classification, legacy self-test matrix, support-file boundary, v085 checkout diff isolation, product PR evidence generator, backup artifact manager, PR recovery autopilot, external blocked split score, PR dependency graph, safe next action, handover snapshot, protected state inventory, and workflow resume state.


- Clean-main baseline and legacy self-test matrix gates to distinguish product PR failures from parent or fixture drift.
- Support-file and source/target manifest boundary gates so target repos do not require source-only harness metadata.
- v085 checkout diff isolation and product PR diff containment gates to keep fixture diff and active product diff separate.
- Product PR evidence generator, validator, and safe-summary gates that keep same-head remote evidence distinct from local or placeholder evidence.
- Backup artifact, repo-external backup, protected state inventory, PR recovery, external blocked, split score, dependency graph, safe next action, and handover snapshot gates.

## What v1.0.1 Adds

- Outcome contract and source-of-truth ownership gates before product behavior changes.
- Plan reviewer worker and anti-accretion gates to catch wrong owner, missing cutover, and dual active path risk.
- Visible acceptance evidence gates that distinguish acceptance evidence from runtime readiness and production readiness.
- Toolchain, parent harness, local branch, target HEAD, same-head main quality-gate, and pilot cleanliness gates.
- Local gate JSON report contract and side-effect guard so `CODEX_QUALITY_REPORT=json` is machine-readable even for failures.
- Small product PR fast path, self-test fixture isolation, authoritative product evidence, target owner action classification, and runtime adoption sequence gates.

## What v1.0.0 Adds

- Parent harness gates: v0.9.9 remains the stable parent while v1.0.0 adds v100 self-test coverage.
- Dynamic workflow gates for plan, DAG, scope, worker budget, branch isolation, file ownership, role matrix, evidence aggregation, merge order, stop/resume, and cost budget.
- Application intelligence gates for codebase maps, entrypoints, module boundaries, dependency/data/API/DB/worker/integration/security/performance/cost maps, dead-code candidates, test gaps, docs drift, confidence, handover, and backlog planning.
- Safe execution gates for cleanup, behavior preservation, refactor slices, public contracts, migration safety, runtime readiness boundaries, and production go boundaries.

## What v1.0.0 Does Not Add

No external dependency, LLM judge requirement, MCP requirement, all-PR browser requirement, hidden chain-of-thought inspection, source self-test product command execution, product code change requirement, target rollout, runtime readiness claim, production readiness claim, unlimited subagent execution, product implementation, dataset audit runner implementation, Game/Tool Adapter runtime implementation, beloved avatar audit runner implementation, migration auto-apply, dead-code deletion without confirmation, or cost/performance claims without evidence is introduced by this source update.

## Running The Core Gate



Node.js 20 or newer is expected. The harness core uses Node.js standard library scripts and does not require npm dependencies. If `package.json` is absent, npm checks are not real verification.



~~~bash

CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs

~~~



Profiles remain v0.7.0-compatible optional artifacts unless a downstream propagation task explicitly updates them.



## Target Repositories



Target repository installs use `docs/process/CODEX_HARNESS_MANIFEST.json`. They must not copy or depend on `CODEX_SOURCE_HARNESS_MANIFEST.json`, which is only for this source harness repository.



Target mode is explicit:



~~~bash

CODEX_HARNESS_MODE=target CODEX_PROFILE_COMPAT_MODE=off CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs

~~~



`CODEX_SKIP_NPM=1` remains valid for harness-only changes with no runtime readiness claim. Product source, tests, specs, package, lockfile, runtime asset, config, Docker, or script-entrypoint changes require the matching product or runtime evidence.
