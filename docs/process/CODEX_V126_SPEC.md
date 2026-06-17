# CODEX_V126_SPEC

CODEX_QUALITY_HARNESS_FILE v1.2.6

## Name

Source HARNESS v1.2.6: Observed-State Bridge-Safe Loop Runtime with
Context-Slim Skill and Validation Routing

## Subtitle

Move long-running autonomy from self-reporting toward observed Git/worktree/PR
state, structured owner/delegated process receipts, short checker/builder loops,
safe failure handoff, and bounded context/skill/validation selection.

## Release Boundary

v1.2.6 is a Source HARNESS body release only.

It does not start target rollout. It does not authorize merge, release, deploy,
wallet/RPC access, funded transactions, governance transactions, BscScan
verification, runtime readiness, production readiness, legal compliance, or
YouTube policy compliance claims.

v1.2.6 must not change product code, package files, lockfiles, runtime code, or
workflows. It must not read raw logs, raw transcripts, raw secrets, wallet/RPC
values, or raw CI payloads into machine evidence. It must not submit GitHub
approval review, self-approve, create new Skills, create new P0 safe artifacts,
create new top-level operator-visible statuses, create a new Final Decision
authority, turn bridge/tunnel/MCP handoff on by default, make PR body text
machine evidence, or bypass same-head remote gate for merge consideration.

## Preserved Authority

v1.1.8 Final Decision remains the final authority for pass/block/mergeAllowed
and exit-code behavior.

v1.1.9 preserves the only P0 safe artifact set:

- `codex-orchestration-capsule.safe.json`
- `codex-worker-proof.safe.json`
- `codex-owner-decision-brief.safe.json`

v1.2.0 adaptive routing, v1.2.1 calibration, v1.2.2 read-budget routing,
v1.2.3 observed skill/decision closure, v1.2.4 delegated autonomy/evidence
semantics, and v1.2.5 goal shard/worktree/evidence lane closure remain internal
to those artifacts.

v1.2.6 is an observed-state loop adapter, not an authority expansion.

## Five P0-Internal Blocks

v1.2.6 compresses the design into five internal blocks. These are machine-only
fields inside the existing v1.1.9 P0 safe artifacts, not new P0 artifacts or new
operator-visible statuses.

### P0-A: Observed Workspace, Owner Receipt, and Capability Boundary

`observedWorkspaceOwnerReceiptAndCapability`

- Capture expected repo, actual safe remote id, branch, head, origin head,
  worktree cleanliness, wrong-cwd, stale-clone, frozen-branch, and mutation
  locality as observed state.
- Wrong cwd, stale clone, frozen branch, dirty worktree, or mutation outside the
  allowed workspace blocks loop continuation.
- Replace PR-body string parsing for owner intent with structured
  `ownerDecisionReceipt`.
- Separate `ownerDecisionReceipt` from `ownerDelegatedProcessReceipt`.
- Owner receipts expire on head change when they authorize merge.
- AI, reviewers, bridge tools, and delegated process receipts cannot create
  owner authority.
- Bridge/tunnel/MCP handoff remains default-off. If used, it is read-only first,
  workspace-write-only, secret-path-blocked, raw-log/raw-transcript-forbidden,
  wallet/RPC/deploy-forbidden, and must emit a safe execution digest.

### P0-B: Spec-First Checker/Builder Loop and Stop Circuit

`specFirstCheckerBuilderLoopAndStopCircuit`

- Builder may edit only inside scoped implementation work.
- Checker is read-only and cannot be the same agent satisfying independent
  review.
- Successful loop closure requires checker output.
- Overall work may run long through shard queues; an individual repair loop must
  stay short.
- Default cap: `maxCycles=5`.
- Same failure repeat cap: `sameFailureRepeatLimit=2`.
- Regression, test weakening, owner boundary, scope boundary, cycle budget, and
  same-failure repeat stop the loop.

### P0-C: Evidence Lane State Machine and Safe Failure Capsule

`evidenceLaneStateMachineAndSafeFailureCapsule`

Lane states:

- `local_pre_pr`: remote evidence missing is normal.
- `pushed_pr_waiting_qg`: remote pending or missing is expected.
- `same_head_remote_qg`: remote pass requires same-head evidence.
- `merge_consideration`: same-head remote pass, owner receipt boundary, and
  Final Decision closure are required.
- `post_merge_sentinel`: main marker, manifest, and drift verification are
  verification only, not merge authority.

Safe failure capsules:

- carry a safe fingerprint, one primary class, safe file/line when available,
  normalized short reason, and one root-cause-only builder instruction.
- must not include raw logs, raw transcript, raw diff, secret values, or raw CI
  payloads.
- cannot authorize scope expansion.

### P0-D: Context / Skill / Validation Budget Router

`contextSkillValidationBudgetRouter`

- Select only necessary context, skills, and validation tier for the current
  task profile.
- Default caps: `maxSkillCount=2`, `maxMdFilesRead=3`.
- Same-head remote gate cannot be skipped for merge consideration.
- Context reduction must not reduce required evidence.
- Skill routing must not reduce required verification.
- Knowledge pointers are context-selection support only and cannot override
  changed-file reality.
- Validation routing can choose lighter checks only when the reason is
  machine-readable and merge evidence requirements remain intact.

### P0-E: Skill / Review / Product Value Effectiveness

`skillReviewProductValueEffectiveness`

- Measure whether a skill changed an outcome, not just whether it loaded.
- Wrong-profile or harmful skill use is hard.
- Track new evidence, avoided failure, reduced diff, added validation, wrong
  skill cost, and net value.
- Review effectiveness tracks new findings, accepted findings, duplicates,
  false positives, assumption differences, decision change, and no-new-signal
  repeats.
- Fanout stops after repeated no-new-signal cycles.
- Product Value Return Gate is advisory pressure only. It cannot authorize
  product code, package/lockfile, runtime, merge, release, deploy, wallet/RPC,
  secrets, readiness, or owner-scope override.
- Repeated harness/evidence-only work should produce a next product slice
  recommendation or stop for owner scope.

## P1 Optional Surfaces

The following remain P1, warning-first, and default-off unless scoped:

- Knowledge Map Capsule
- Bridge Handoff Extended Mode
- Operator Output Discipline
- Repo-specific Visual Proof
- Safe Session Learning Proposal
- Architecture Entropy Watch

Knowledge maps are context-selection support only, not merge evidence, runtime
readiness, owner approval, or Final Decision authority.

## Source-Hard Versus Target-Warn

In Source HARNESS, v1.2.6 field absence, authority expansion, wrong workspace,
stale clone, raw input in safe failure capsules, bridge default-on, owner
receipt created by AI, same-head bypass, checker mutation, test weakening,
regression continuation, harmful skill, wrong-profile skill, fanout without new
signal, or Product Value Return Gate scope authorization are hard failures.

In target rollout, missing optional P1 fields and unknown positive skill/review
value start as warnings unless harm or wrong-profile use is detected. Raw logs,
self approval, GitHub approval review by an agent, owner authority bypass,
wallet/RPC/deploy access, readiness claims, and product/package/runtime scope
expansion remain hard failures.

## Self-Test Requirements

`scripts/codex-v126-self-test.mjs` must prove:

- no new P0 artifact
- no new top-level operator-visible status
- v1.1.8 Final Decision authority preserved
- v1.1.9 P0 artifact/status compatibility preserved
- v1.2.0 through v1.2.5 compatibility preserved
- active authority tuple points to v1.2.6 / v126 / this spec
- wrong cwd, stale clone, frozen branch, and dirty mutation state block loops
- merge owner action requires structured receipt bound to head and expiring on
  head change
- owner/delegated receipts cannot be AI-created
- delegated process cannot authorize release/deploy/wallet/RPC/secret/readiness
  or GitHub approval review
- bridge/tunnel/MCP behavior is default-off and transcript is not machine
  evidence
- checker is read-only and cannot satisfy independent check alone
- loop stops on regression, test weakening, cycle cap, and repeated same failure
- merge consideration requires same-head remote pass and Final Decision closure
- safe failure capsule forbids raw logs, raw transcripts, raw diffs, and scope
  expansion
- context/skill/validation router caps skills and md reads
- router cannot skip same-head remote gate for merge
- skill/review/product value effectiveness blocks harmful skill, repeated
  no-new-signal fanout, and product scope authorization
- worker proof observes Git/worktree/PR state without granting merge authority
- owner decision brief contains structured owner/delegated process receipts

## Safety Line

Source HARNESS v1.2.6 is an observed-state, bridge-safe, context-slim loop
runtime improvement only. It is not runtime readiness, production readiness,
legal compliance, YouTube policy compliance, deployment permission, target
rollout, merge permission, GitHub approval review, or owner authority.
