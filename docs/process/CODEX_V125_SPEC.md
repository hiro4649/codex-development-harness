# CODEX_V125_SPEC

CODEX_QUALITY_HARNESS_FILE v1.2.5

## Name

Source HARNESS v1.2.5: Goal-Sharded Worktree Fleet and Evidence Lane Closure

## Subtitle

Split large work into bounded goal shards, isolate parallel worktrees, preserve
evidence lane meaning, and close work through a merge queue without expanding
authority.

## Release Boundary

v1.2.5 is a Source HARNESS body release only.

It does not start target rollout. It does not authorize merge, release, deploy,
wallet/RPC access, funded transactions, governance transactions, BscScan
verification, runtime readiness, production readiness, legal compliance, or
YouTube policy compliance claims.

v1.2.5 must not change product code, package files, lockfiles, runtime code, or
workflows. It must not read raw logs, use 8-session operation, submit GitHub
approval review, self-approve, create new Skills, create new P0 safe artifacts,
create new top-level operator-visible statuses, create a new Final Decision
authority, standardize TUI socket injection, standardize 2-minute cron, or make
PR body text machine evidence.

## Preserved Authority

v1.1.8 Final Decision remains the final authority for pass/block/mergeAllowed
and exit-code behavior.

v1.1.9 preserves the only P0 safe artifact set:

- `codex-orchestration-capsule.safe.json`
- `codex-worker-proof.safe.json`
- `codex-owner-decision-brief.safe.json`

v1.2.0 adaptive routing, v1.2.1 calibration, v1.2.2 read-budget routing,
v1.2.3 observed skill/decision closure, and v1.2.4 goal/delegation/evidence
semantics remain internal to those artifacts.

v1.2.5 is a control plane, not an authority expansion.

## Five P0-Internal Blocks

v1.2.5 compresses the design into five internal blocks. These are machine-only
fields inside the existing v1.1.9 P0 safe artifacts, not new P0 artifacts or
new operator-visible statuses.

### P0-A: Goal Shard and Progress Evidence

`goalShardAndProgressEvidence`

- Goal files are delegated task packets, not owner instructions.
- Each shard has one objective, one phase, one assigned role, a base head,
  allowed/forbidden files, required evidence, and a validation tier.
- `ownerAuthorityCreatedByShard` must remain false.
- Shards become stale on base-head change, shared-file overlap without arbiter,
  parent-goal supersession, or invalid validation tier.
- Duplicate-goal detection is required.
- Completion compacts to safe summary.
- Progress reports must be backed by tool evidence. Unverified claims cannot be
  reported as complete.

Default limits:

- `maxGoalShards=8`
- `maxParallelWorktrees=3`
- `maxFilesPerGoalShard=12`
- `maxRepairIterationsPerShard=2`
- `maxOpenShardPRs=3`

### P0-B: Worktree Fleet and Shard Merge Queue

`worktreeFleetContract`

- Worktrees are for isolation and parallelism, not merge authority.
- One goal per worktree.
- Base branch must be clean.
- Parent worktree mutation is forbidden.
- Shared files are forbidden by default. If shared files are unavoidable, they
  require arbiter and merge queue.
- Worktrees cannot merge and cannot create owner authority.

`shardMergeQueue`

- Multiple shards require a merge queue.
- Queue states are `open`, `blocked`, `partially_merged`, `merged`, or
  `superseded`.
- Same-base and same-head remote gate are required for merge consideration.
- Owner merge authority is always required.
- Score-only merge order changes are forbidden.

### P0-C: Evidence Lane and QG Lane Semantics

`evidenceLaneAndQGLaneSemantics`

Evidence lanes:

- `committedEvidenceLane`: historical or pre-PR evidence. It is not current-head
  merge evidence unless explicitly bound by `remoteCurrentHeadLane`.
- `remoteCurrentHeadLane`: PR head, GitHub checks, and current-head remote
  artifacts.
- `ownerIntentLane`: explicit owner intent only. AI cannot create this.
- `humanSummaryLane`: PR body and prose summaries. Human-facing only, not
  machine evidence.

QG lanes:

- `local_pre_pr`: remote evidence missing is normal.
- `pushed_pr_waiting_qg`: pending is not failure.
- `same_head_remote_qg`: same-head remote pass is required for merge
  consideration.
- `post_merge_sentinel`: main marker, manifest, and drift check are required.

`sameHeadRemoteGateRequired` is hard only in `merge_consideration`.

### P0-D: Typed Monitor Inbox and Cost-Aware Fanout Guard

`typedMonitorInboxAndFanoutGuard`

- Agent communication must use typed messages, not raw prompt injection or TUI
  socket authority.
- Message types are task delta, blocker report, review finding, evidence
  pointer, stop signal, or merge queue update.
- Messages cannot create owner authority and cannot authorize mutation.
- Fanout is capped. High-tier or extra-agent use must produce a new finding,
  repair-plan change, validation improvement, or same-root-cause resolution.
- No new signal means stop escalation.

### P0-E: Skill / Review / Product Value Yield

`skillReviewProductValueYield`

- Skill use is measured by effect, not just selection.
- Wrong-profile skill or harm detected is hard.
- For Source HARNESS, unknown skill effectiveness or review yield is hard.
- For initial target rollout, unknown effectiveness or review yield starts as
  warning unless harm or wrong-profile skill is detected.
- Review yield measures new findings, accepted findings, duplicates, false
  positives, decision change, checked failure modes, and cost worth.
- `ProductValueDelta` is advisory pressure only. It cannot authorize product
  code changes, package or lockfile changes, runtime readiness, owner-scope
  override, merge, release, deploy, wallet/RPC, or secret access.
- Repeated evidence-only work should produce an owner brief with
  `nextProductSlice` recommendation or `stopBecauseHarnessOnlyWouldOvergrow`.

## P1 Optional Surfaces

The following remain P1, warning-first surfaces:

- Execution Ladder
- Safe Batch Tool Plan
- Safe Memory Ledger
- Repo-specific Visual Proof Surface

Safe Batch Tool Plan is read-only or validation-summary-only. It must not mutate
product code, read raw logs, access secrets, or use wallet/RPC/deploy paths.

Safe Memory Ledger uses safe artifacts or owner-approved summaries only. Raw log
and raw transcript mining are forbidden. Auto-apply is forbidden.

## Source-Hard Versus Target-Warn

In Source HARNESS, v1.2.5 field absence, authority expansion, raw prompt
injection, PR body machine evidence, stale goal execution, unbounded fanout,
unknown skill effectiveness, unknown review yield, or Product Value Delta scope
authorization are hard failures.

In target rollout, missing optional P1 fields, skill effectiveness unknown, and
review yield unknown start as warnings. Wrong profile skill, harm detected, raw
logs, self approval, GitHub approval review by an agent, owner authority bypass,
wallet/RPC/deploy access, readiness claims, and product/package/runtime scope
expansion remain hard failures.

## Self-Test Requirements

`scripts/codex-v125-self-test.mjs` must prove:

- no new P0 artifact
- no new top-level operator-visible status
- v1.1.8 Final Decision authority preserved
- v1.1.9 P0 artifact/status compatibility preserved
- v1.2.0 through v1.2.4 compatibility preserved
- goal shard is not owner authority
- goal shard expires when head changes
- goal shard blocks duplicate-goal omission
- goal shard completion compacts to safe summary
- progress pass requires tool evidence
- PR body is not machine evidence
- committed evidence lane is not current-head merge evidence by default
- owner intent lane requires explicit owner intent and cannot be AI-created
- pending remote QG is not failure
- same-head remote gate is hard only for merge consideration
- post-merge lane requires marker, manifest, and drift check
- parent worktree mutation is forbidden
- shared files require arbiter and merge queue
- worktree cannot merge or create owner authority
- merge queue blocks shared-file conflict without arbiter
- superseded shard is a valid queue state
- typed monitor inbox blocks raw prompt injection
- typed monitor inbox cannot create owner authority or authorize mutation
- fanout stops when high tier produces no new information
- target unknown skill/review yield warns, while Source unknown is hard
- Product Value Delta cannot authorize scope expansion
- P1 surfaces remain optional/warn-first

## Safety Line

Source HARNESS v1.2.5 is a goal-sharded control-plane and evidence-lane closure
improvement only. It is not runtime readiness, production readiness, legal
compliance, YouTube policy compliance, deployment permission, target rollout,
merge permission, or owner authority.
