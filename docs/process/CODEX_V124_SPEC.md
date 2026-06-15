# CODEX_V124_SPEC

CODEX_QUALITY_HARNESS_FILE v1.2.4

## Name

Source HARNESS v1.2.4: Goal-Scoped Delegated Autonomy and Evidence Semantics

## Subtitle

Delegate technical evaluation inside the goal scope. Preserve owner authority.
Explain what each proof proves.

## Release Boundary

v1.2.4 is a Source HARNESS body release only.

It does not start target rollout. It does not authorize merge, release, deploy,
wallet/RPC access, funded transactions, governance transactions, BscScan
verification, runtime readiness, production readiness, legal compliance, or
YouTube policy compliance claims.

v1.2.4 must not change product code, package files, lockfiles, runtime code, or
workflows. It must not read raw logs, use 8-session operation, submit GitHub
approval review, self-approve, create new Skills, create new P0 safe artifacts,
create new top-level operator-visible statuses, create a new Final Decision
authority, or make PR body text machine evidence.

## Preserved Authority

v1.1.8 Final Decision remains the final authority for pass/block/mergeAllowed
and exit-code behavior.

v1.1.9 preserves the only P0 safe artifact set:

- `codex-orchestration-capsule.safe.json`
- `codex-worker-proof.safe.json`
- `codex-owner-decision-brief.safe.json`

v1.2.0 adaptive routing, v1.2.1 calibration, v1.2.2 read-budget routing, and
v1.2.3 observed skill/decision closure remain internal to those artifacts.

v1.2.4 is a Final Decision Closure Adapter. It normalizes goal, delegation,
evidence, expert review, failure, owner burden, and target footprint fields
before the v1.1.8 Final Decision authority is applied. It does not replace or
compete with that authority.

## Core Principle

AI does not decide instead of the owner. AI operates inside the scope where owner
judgment is not required.

Expert agents may decide technical evaluation and one safe next action inside
the delegated goal scope. They may not create owner authority. They may not
merge, release, deploy, access wallet/RPC/secrets, submit GitHub approval
review, claim readiness, or widen product/runtime/package scope.

## Five P0-Internal Blocks

v1.2.4 compresses the design into five internal blocks rather than expanding a
large module surface.

### P0-A: Goal Contract and Delegation Boundary

`goalContract`

- Defines the desired end state, success criteria, required evidence,
  forbidden shortcuts, verification plan, terminal action, delegable actions,
  non-delegable actions, budget, stop condition, and one safe next action.
- Completion requires `goalCompletionProof`.

`delegationBoundary`

- Replaces ambiguous `finalHumanJudgmentRequired=false` style fields.
- Uses `ownerAuthorityState`, `ownerAuthorityCreatedByAI=false`, and
  `ownerOnlyAuthorityBypassed=false`.
- Expert judgment cannot merge, release, deploy, claim readiness, submit GitHub
  approval review, or create owner authority.
- Delegation can be revoked with `delegationRevocation`.
- Expert disagreement must be handled with `expertDisagreement`.

### P0-B: Bounded Expert Loop and Expert Roles

`boundedExpertLoop`

- Allows long-running work only inside explicit caps.
- Required caps: `maxLoopCycles=4`, `maxRepairIterations=3`,
  `maxSameRootCauseRepeats=2`, `maxHighTierUses=1`, and `maxReviewerCount=3`.
- Continuation requires new evidence and validation delta.
- Loop exit must have exactly one `loopExitReason`.

`expertRoleLedger`

- Builder implements but does not decide.
- Boundary Agent checks forbidden scope and owner boundaries.
- Evidence Agent checks same-head, freshness, artifact precedence, and PR-body
  non-authority.
- Quality Agent checks implementation/test quality and regression risk.
- Inventory and Value Pressure Agent detects evidence PR overgrowth and
  unnecessary harness repair. It cannot authorize product code, package,
  lockfile, runtime, readiness, or scope expansion.
- Skeptic Agent is abnormal-condition only. It is triggered by repeated root
  cause, authority ambiguity, security/restricted-asset ambiguity,
  runtime/readiness ambiguity, reviewer disagreement, or evidence contradiction.

### P0-C: Evidence Semantics Kernel

`evidenceSemanticsKernel`

- Separates committed evidence from current-head evidence.
- PR body is human summary only, not machine evidence.
- Safe artifacts are machine evidence authority.
- Current-head merge consideration requires same-head evidence.
- PASS must be typed: local validation, same-head remote validation,
  merge policy, runtime evidence, product readiness, and owner authority are
  separate.
- Evidence capability must state what a proof supports and what it does not
  support.
- Canonical status normalization must happen before Final Decision closure.

### P0-D: Safe Failure Digest and Owner Burden Reduction

`safeFailureDigest`

- Diagnoses failure without raw logs.
- Classifies failure and repair scope: none, harness-only, docs-only,
  product-requires-owner-scope, or stop-only.
- Must not force repair PR creation.

`ownerBurdenReducer`

- Reduces owner questions without erasing owner-only boundaries.
- Owner question count is minimized, exact choices are capped at three, and
  owner authority is preserved.

`safeSessionLearningProposal`

- Optional, proposal-only, safe-artifact-only.
- Raw logs and raw transcript mining are forbidden.
- Auto-apply is forbidden.
- Owner approval is required before any rule promotion.

### P0-E: Target Harness Footprint Policy

`targetHarnessFootprintPolicy`

- Target repos must remain harness-aware, not harness-hosting.
- No new P0 artifacts, top-level statuses, new Skills, workflows, product code,
  runtime code, package files, or lockfiles.
- Target guidance should stay compact: AGENTS max 80 lines, target spec max 220
  lines, active policy index max 8 entries.
- Visual proof is repo-specific optional for UI, frontend, and Live2D profiles.
  It is not required for Source HARNESS, backend-only, or token-only managed
  profiles.

## Source-Hard Versus Target-Warn

In the Source HARNESS repo, missing v1.2.4 fields, owner authority creation,
owner-only bypass, unbounded loop, always-on Skeptic review, unsafe evidence
semantics, PR-body machine evidence, raw logs, auto-applied session learning,
or target footprint expansion are hard failures.

In target repos before rollout, v1.2.4 fields may be absent. After rollout,
missing optional visual proof or session learning fields are warnings unless the
target profile declares them hard.

Target hard failures remain: raw logs, wrong workspace during mutation,
self-approval, GitHub approval review submitted by an agent, wallet/RPC/deploy
access, readiness/production/legal/YouTube claims, wrong profile Skill,
Final Decision closure inconsistency, and owner authority bypass.

## Self-Test Requirements

`scripts/codex-v124-self-test.mjs` must prove:

- no new P0 artifact
- no new top-level operator-visible status
- v1.1.8 Final Decision authority preserved
- v1.1.9 P0 artifact/status compatibility preserved
- v1.2.0/v1.2.1/v1.2.2/v1.2.3 compatibility preserved
- goal contract does not create owner authority
- goal completion requires required evidence and executed verification plan
- delegated expert judgment cannot merge without owner scope
- owner authority state is explicit and cannot be bypassed
- Final Decision Closure Adapter is not a new Final Decision Kernel
- bounded loop stops without new evidence
- bounded loop stops after same root cause repeat
- high-tier use is capped
- Skeptic Agent is not required for metadata-light work
- Inventory and Value Pressure Agent cannot expand product scope
- evidence phase rejects self-referential current-head commit requirements
- PR body is not machine evidence
- quality-gate PASS does not imply readiness, owner approval, legal compliance,
  YouTube compliance, release permission, or deploy permission
- safe failure digest does not force repair PR
- safe session learning is proposal-only and owner-approval-required
- repo-specific visual proof remains optional and profile-scoped
- target footprint blocks new top-level status, new P0 artifact, new Skill,
  workflow, product, runtime, package, and lockfile expansion

## Safety Line

Source HARNESS v1.2.4 is a delegated technical evaluation and evidence semantics
improvement only. It is not runtime readiness, production readiness, legal
compliance, YouTube policy compliance, deployment permission, target rollout,
merge permission, or owner authority.
