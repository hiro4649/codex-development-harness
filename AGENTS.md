# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.2.5

## Prime Directive

Ship the smallest correct change that increases product value without weakening
truth, trust, security, or maintainability.

## Source Harness Boundary

This repository is the Codex Development Harness source. Work here must stay in
the harness itself unless a task explicitly names a downstream project. Do not
change downstream project repositories from source harness work.
Use `docs/process/CODEX_OPENAI_CODEX_METHOD_POLICY.md` and
`docs/process/code_review.md` as the stable method references.
For v1.0.1 through v1.0.3 outcome, recovery, fixture isolation, clean-main,
judgment consistency, product surface routing, review taxonomy, stale input,
external blocked, handover, branch/head, and local gate contract routing, use
the matching `docs/process/CODEX_*_POLICY.md` files.
For v1.0.4 claim-to-code, boundary linting, acceptance criteria, risk, evidence
v2, GitHub hysteresis, tool gap, active self-test, hotfix preservation,
PR-chain saturation, role/tool, evidence site, annotation, and Dynamic Workflow
Lite governance, use `docs/process/CODEX_V104_SPEC.md` and the matching
`docs/process/CODEX_*_POLICY.md` or schema files.
For v1.0.5 through v1.0.8 integration reliability, lane separation,
provenance, evidence closure, bounded validation, safe repair mapping,
branch isolation, review intake, manual gate audit, and controlled
orchestration, use
`docs/process/CODEX_V105_INTEGRATION_EVIDENCE_RELIABILITY_POLICY.md`,
`docs/process/CODEX_V106_LANE_PROVENANCE_RECOVERY_POLICY.md`,
`docs/process/CODEX_V107_GEAR_POLICY.md`,
`docs/process/CODEX_V108_SPEC.md`, and their schema files.
For v1.0.9 Decision Ledger and Evidence Convergence, use
`docs/process/CODEX_HARNESS_V1_0_9_DECISION_LEDGER_POLICY.md`,
`docs/process/CODEX_DECISION_LEDGER_SCHEMA_V1_0_9.json`,
`docs/process/CODEX_REPAIR_PLAN_SAFE_SCHEMA_V1_0_9.json`, and
`docs/process/CODEX_STATUS_TAXONOMY_V1_0_9.json`.
For v1.1.0 Token Economy and Operational Closure, use
`docs/process/CODEX_HARNESS_V1_1_0_TOKEN_ECONOMY_POLICY.md`,
`docs/process/CODEX_V110_SPEC.md`, and
`docs/process/CODEX_STATUS_TAXONOMY_V1_1_0.json`.
For v1.1.1 Token Hard Cap, Context Capsule, and Failure Closure, use
`docs/process/CODEX_HARNESS_V1_1_1_TOKEN_HARD_CAP_CONTEXT_CAPSULE_FAILURE_CLOSURE_POLICY.md`,
`docs/process/CODEX_V111_SPEC.md`, and
`docs/process/CODEX_STATUS_TAXONOMY_V1_1_1.json`.
For v1.1.2 Conversation Surface Minimization and Evidence Fidelity, use
`docs/process/CODEX_V112_SPEC.md`,
`docs/process/CODEX_HARNESS_V1_1_2_CONVERSATION_SURFACE_EVIDENCE_FIDELITY_POLICY.md`,
and the matching v1.1.2 taxonomy, reason dictionary, rollout manifest, and
command output policy files.
For v1.1.3 Minimal Surface, Fast Gates, Typed Decisions, and Compatibility
Proof, use `docs/process/CODEX_V113_SPEC.md`,
`docs/process/CODEX_HARNESS_V1_1_3_MINIMAL_SURFACE_FAST_GATES_COMPATIBILITY_PROOF_POLICY.md`,
and `docs/process/CODEX_STATUS_TAXONOMY_V1_1_3.json`.
For v1.1.4 Loop Kernel and Deterministic Guardrails, use
`docs/process/CODEX_V114_SPEC.md`. Preserve v1.1.3 safety profile, same-head
checks, token economy, raw-log prohibition, 8-session default fail, and target
rollout prohibition until a separate owner instruction authorizes rollout.
v1.1.4 finalizes Loop Kernel with Decision Core, Minimal Blockers, status
tiering, remote evidence state machine, forbidden scope IDs, and token cost
ledger.
For v1.1.5 Trace Kernel, Policy Hooks, Skill Profiles, and Token-Thin
Finalizer, use `docs/process/CODEX_V115_SPEC.md` and
`docs/process/CODEX_V115_PROFILE_REGISTRY.json`. Decision Core v2 is
authoritative. Minimal Blockers come first. Prefer trace pointers over repeated
history, and Skill Profile IDs over long forbidden text. Policy Hooks fail
closed. PR bodies are rendered human output, not machine decision sources.
Same-head required checks remain required. Raw logs, 8-session operation, and
product/harness repair mixing remain forbidden.
For v1.1.6 Decision Capsule, Evidence Precedence Kernel, and Token Hard Budget,
use `docs/process/CODEX_V116_SPEC.md`. Decision Capsule is the first decision
source. Evidence Precedence Kernel decides artifact priority. PR body is not
machine evidence. Token Hard Budget is enforced. Policy/profile IDs replace
long forbidden text. Same-head required checks remain mandatory. Raw logs and
8-session are forbidden. Product/harness repair separation is required. Target
rollout is not part of Source body tasks.
For v1.1.7 Outcome-Verified Decision Capsule and Artifact-Consistent Minimal
Surface, use `docs/process/CODEX_V117_SPEC.md`. Preserve Decision Capsule
authority, require concrete Outcome and read-only Verifier Capsules, prove
load-bearing artifact consistency, emit delta-only final summaries, and read
failures through safe artifacts only. Keep operator-visible statuses within the
budget and keep target rollout out of Source body tasks.
For v1.1.8 Final Decision Kernel and Mode-Aware Evidence Contract, use
`docs/process/CODEX_V118_SPEC.md`. Final Decision is execution and exit-code
authority; Decision Capsule remains domain decision authority. Evidence Capsule
is machine evidence authority, Safe Summary is display-only, and workflow exit
must delegate to Final Decision. Preserve mode-aware artifact contracts,
local/remote evidence separation, convergence stop rules, token budget limits,
raw-log prohibition, 8-session default fail, product/harness repair separation,
and target rollout prohibition.
For v1.1.9 Maintainer Orchestration Lite and Worker Proof Contract, use
`docs/process/CODEX_V119_SPEC.md`. v1.1.9 adds only preparatory orchestration
evidence through exactly three P0 safe artifacts: Orchestration Capsule, Worker
Proof, and Owner Decision Brief. v1.1.8 Final Decision remains the only final
pass/block/mergeAllowed/exit-code authority. v1.1.9 must not create workflow
engine behavior, release/deploy/wallet/RPC authority, broad memory, scheduler,
external verifier runtime, target rollout, or extra operator-visible status
surface.
For v1.2.0 Adaptive Intelligence Escalation and Review Pool, use
`docs/process/CODEX_V120_SPEC.md`. v1.2.0 adds only token-aware model-tier
routing, typed blockers, review-pool policy, escalation hysteresis, and
high-tier repair planning inside the existing v1.1.9 P0 artifacts. Preserve
the v1.1.9 top-level operator status surface, especially `reviewChainStatus`.
v1.2.0 must not create owner approval, GitHub approval review, release, deploy,
wallet/RPC, BscScan, readiness, legal compliance, YouTube policy compliance,
new P0 artifacts, scheduler behavior, external verifier runtime, memory
routing, target rollout, or merge authority.
For v1.2.1 Adaptive Routing Metrics and Evidence Calibration Guard, use
`docs/process/CODEX_V121_SPEC.md`. v1.2.1 adds only internal calibration fields
inside the existing v1.1.9 P0 artifacts: adaptive metrics, routing calibration,
evidence freshness, target score baseline, root-cause loop guard, boundary diff
classification, claim lint, owner burden metrics, and merge decision integrity.
Preserve the v1.1.8 Final Decision authority, the v1.1.9 artifact set and
operator status surface, and the v1.2.0 adaptive routing/review pool contracts.
v1.2.1 must not add new P0 artifacts, top-level statuses, target rollout,
product/package/runtime/workflow changes, raw-log access, 8-session use,
wallet/RPC/deploy access, self approval, GitHub approval review, readiness
claims, legal compliance claims, or YouTube policy compliance claims.
For v1.2.2 Context-Aware Skill Routing and Read Budget Discipline, use
`docs/process/CODEX_V122_SPEC.md`. v1.2.2 adds only the internal
`skillContextRouting` field inside `codex-orchestration-capsule.safe.json`.
Read less, preserve authority: read `AGENTS.md`, the active manifest, and the
active v1.2.2 spec first; defer README, legacy specs, and PR history unless the
task profile or a safe artifact pointer requires them. Use repo/task profile
IDs for repeated forbidden scope text while keeping repo-specific absolute
no-go actions visible. Preserve the v1.1.8 Final Decision authority, the v1.1.9
artifact/status surface, v1.2.0 routing/review pool, and v1.2.1 calibration.
v1.2.2 must not add new P0 artifacts, top-level statuses, new Skills, target
rollout, product/package/runtime/workflow changes, raw-log access, full
history reads without scope, wallet/RPC/deploy access, self approval, GitHub
approval review, readiness claims, legal compliance claims, or YouTube policy
compliance claims.
For v1.2.3 Observed Skill Evidence and Decision Closure, use
`docs/process/CODEX_V123_SPEC.md` and
`docs/process/CODEX_ACTIVE_POLICY_INDEX.json`. v1.2.3 adds only internal
observed context/skill evidence, final decision closure, workspace identity,
skill contract, escalation effectiveness, reviewer independence, review loop,
and owner closure summary fields inside the existing v1.1.9 P0 artifacts.
It turns skill and md routing from declaration toward bounded observed
metadata, and blocks unexplained contradictions between target quality, same
head evidence, blockers, merge scope, terminalAction, and mergeAllowed.
Preserve v1.1.8 Final Decision authority, the v1.1.9 artifact/status surface,
v1.2.0 adaptive routing/review pool, v1.2.1 calibration, and v1.2.2 read
budget routing. v1.2.3 must not add new P0 artifacts, top-level statuses, new
Skills, target rollout, product/package/runtime/workflow changes, raw-log
access, full history reads without scope, wallet/RPC/deploy access, self
approval, GitHub approval review, readiness claims, legal compliance claims,
or YouTube policy compliance claims.
For v1.2.4 Goal-Scoped Delegated Autonomy and Evidence Semantics, use
`docs/process/CODEX_V124_SPEC.md` and
`docs/process/CODEX_ACTIVE_POLICY_INDEX.json`. v1.2.4 adds only internal
Goal Contract, Delegation Boundary, Evidence Semantics, Bounded Expert Loop,
Safe Failure/Owner Burden, and Target Footprint fields inside the existing
v1.1.9 P0 artifacts. v1.2.4 is a Final Decision Closure Adapter, not a new
Final Decision authority. Expert agents may evaluate technical risk and one
safe next action only inside delegated scope; they must not create owner
authority, merge/release/deploy, access wallet/RPC/secrets, submit GitHub
approval review, claim readiness, or widen product/runtime/package scope.
Skeptic review is abnormal-condition only. Safe session learning is
proposal-only, safe-artifact-only, owner-approval-required, and never auto
applied. Visual proof is repo-specific optional, not global P0.
For v1.2.5 Goal-Sharded Worktree Fleet and Evidence Lane Closure, use
`docs/process/CODEX_V125_SPEC.md` and
`docs/process/CODEX_ACTIVE_POLICY_INDEX.json`. v1.2.5 is a control plane, not
an authority expansion. It adds only internal Goal Shard/Progress Evidence,
Worktree Fleet/Shard Merge Queue, Evidence Lane/QG Lane, Typed Monitor
Inbox/Fanout Guard, and Skill/Review/Product Value Yield fields inside the
existing v1.1.9 P0 artifacts. Goal files are delegated task packets, not owner
instructions. PR body remains human summary, not machine evidence. Same-head
remote gate is hard only for merge consideration. Product Value Delta is
advisory pressure only and cannot authorize product/package/runtime scope,
readiness, merge, release, deploy, wallet/RPC, secrets, or owner authority.
v1.2.5 must not add new P0 artifacts, top-level statuses, new Skills, target
rollout, product/package/runtime/workflow changes, raw-log or raw-transcript
mining, TUI socket injection, 2-minute cron, self approval, GitHub approval
review, or readiness/legal/YouTube compliance claims.

## Plan-First Rule

Use plan-first for R3, ambiguous, security-sensitive, migration, release,
dependency, multi-file, or architecture tradeoff work. Keep the plan short and
tie it to affected areas, entrypoints, and failure propagation risk.

## Safe Output Rule

Use safe summary only. Do not print raw logs, raw diffs, raw payloads, secret
values, endpoint values, private paths, production data, or personal data.

## Merge-Ready Claim Rule

Do not claim merge-ready unless required gates, current-head evidence, CI replay
where applicable, and human confirmation rules are satisfied.

## Task Discipline

Before editing, classify work as bugfix, feature, refactor, investigation,
review, release-gate, harness-change, or docs-only. For bugfix work, use the
`codex-bugfix` skill and write reproduction status plus root-cause hypothesis
before code edits unless the change is documentation-only. Keep task-specific
workflow detail in skills or `docs/process`, not in AGENTS.md.
In 5.5 low mode, keep one PR/repo focus, avoid broad changes, and return
exactly one safe next action.

## Agent Doctrine And Skill Routing

Keep AGENTS.md as a compact doctrine and routing map. Load only the skills
needed for the task, normally four or fewer and never more than five. Route
details, review matrices, containment boundaries, state-machine evidence, and
minimal evidence rules live in `docs/process/CODEX_AGENTS_DOCTRINE_POLICY.md`,
`docs/process/CODEX_SKILL_ROUTING_POLICY.md`, and the related v0.9.5 policy
files.

## Manual Confirmation Limit

Manual confirmation cannot override non-overridable failures: secret scan,
blocked paths, high-confidence sensitive findings, stale evidence, unsafe
output, implementation/harness mixing, or weakened quality gates.

## Profile/Core Separation

Root source harness version and profile template version are separate. In
`CODEX_HARNESS_MODE=core`, profiles are optional compatibility artifacts and
must not be required for core quality score.

<!-- CODEX_QUALITY_HARNESS_END -->
