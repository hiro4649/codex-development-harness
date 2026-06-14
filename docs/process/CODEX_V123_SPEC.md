# CODEX_V123_SPEC

CODEX_QUALITY_HARNESS_FILE v1.2.3

## Name

Source HARNESS v1.2.3: Observed Skill Evidence and Decision Closure

## Subtitle

Prove what was read. Prove what worked. Prove why it stopped.

## Release Boundary

v1.2.3 is a Source HARNESS body release only.

It does not start target rollout. It does not authorize merge, release, deploy,
wallet/RPC access, funded transactions, governance transactions, BscScan
verification, runtime readiness, production readiness, legal compliance, or
YouTube policy compliance claims.

v1.2.3 must not change product code, package files, lockfiles, runtime code, or
workflows. It must not read raw logs, use 8-session operation, submit GitHub
approval review, self-approve, create new Skills, create new P0 safe artifacts,
or create new top-level operator-visible statuses.

## Preserved Authority

v1.1.8 Final Decision remains the final authority for pass/block/mergeAllowed
and exit-code behavior.

v1.1.9 preserves the only P0 safe artifact set:

- `codex-orchestration-capsule.safe.json`
- `codex-worker-proof.safe.json`
- `codex-owner-decision-brief.safe.json`

v1.2.0 adaptive intelligence routing and review pool remain internal to those
artifacts. v1.2.1 calibration and evidence freshness remain internal. v1.2.2
skill/context routing and read budgets remain internal.

v1.2.3 only adds internal fields inside the existing P0 artifacts and one
non-P0 active policy index file.

## Problem Statement

v1.2.2 reduces context overread and blocks unsafe scope well, but it is still
too declarative in three places:

1. A task can show `targetQuality=pass`, no blocking reasons, and same-head
evidence while still ending in `create_pr_only` or `mergeAllowed=false` without
one typed closure reason.
2. Skill use can be declared without proving whether the selected skill was
appropriate, effective, or harmful.
3. Reviewer loops can look formally separate while sharing the same blind spot,
or can repeat without a stop condition.

v1.2.3 closes those gaps without expanding the operator status surface.

## New Internal Fields

All v1.2.3 fields are nested inside existing P0 artifacts.

### Orchestration Capsule

`finalDecisionClosure`

- Normalizes the relationship between phase, terminalAction, targetQuality,
  same-head remote gate, explicit blockers, owner/delegated merge scope, and
  mergeAllowed.
- If all merge prerequisites pass but mergeAllowed is false, the closure must
  fail as `decision_closure_inconsistent`.
- If terminalAction is `merge_current_pr`, same-head remote gate must be pass,
  targetQuality must be pass, blockingReasonsCount must be zero, and owner or
  delegated merge scope must be valid.

`workspaceIdentityGate`

- Records expected repo, remote URL, branch, HEAD, AGENTS marker, manifest
  active version, dirty worktree state, and frozen branch use.
- Blocks mutation from wrong repo, frozen branch, unresolvable remote, local-only
  state, or dirty worktree without explicit preservation scope.

`activePolicyIndex`

- Points to `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`.
- Converts "read less" into a task-profile routing table.
- Keeps normal required reads to AGENTS, manifest, and active spec.
- README, legacy specs, and PR history are deferred unless explicitly allowed by
  task profile, compatibility failure, authority conflict, owner request, or safe
  artifact pointer.

`contextReadLedger`

- Records observed md/skill/spec/safe-artifact reads as bounded safe metadata.
- Raw logs and full history reads are hard failures.
- Legacy spec reads require compatibility failure or authority conflict.
- PR history reads require safe artifact pointer or owner request.

`skillContractRegistry`

- Requires selected skills to have Skill Contract v2 metadata.
- Contract fields: `when_to_use`, `when_not_to_use`,
  `allowed_repo_profiles`, `forbidden_repo_profiles`, `task_profiles`,
  `max_context_tokens`, `required_artifacts`, `forbidden_actions`,
  `artifact_pointer_first`, `raw_logs_forbidden`,
  `owner_decision_boundary`, and `output_contract`.
- Missing selected-skill contracts are source-hard failures.

`skillEffectivenessLedger`

- Records whether a selected skill was useful, neutral, harmful, or unknown.
- Records its decision impact: blocked forbidden action, shortened validation,
  reduced md reads, produced review primary class, reduced owner question, no
  effect, or unknown.
- Source HARNESS body work must not leave selected skill contribution or impact
  unknown.

`escalationEffectivenessLedger`

- Checks whether added reviewers or higher reasoning models produced new
  information, changed the repair plan, improved validation, or resolved the same
  root cause.
- Highest-reasoning escalation without any new signal is blocked.
- Higher tier cannot create owner authority.

### Worker Proof

`reviewerIndependenceProof`

- Distinguishes independent review from same-worker self-review.
- Same worker review is advisory only and cannot count as independent.
- Reviewer cannot see raw logs, submit GitHub approval review, approve owner
  decision, merge, or claim readiness.
- Independent review findings require a primary class.

`reviewLoopVerification`

- Records loop count, reviewer count, finding counts, accepted/rejected counts,
  negative findings, repeated root cause, repeated finding, disagreement, and
  loop saturation.
- Harness, product, runtime, security, and restricted-asset profiles require at
  least one negative hypothesis when reviewerCount > 0.
- Repeated same finding or same root cause blocks unless new evidence changes the
  class.

### Owner Decision Brief

`finalDecisionClosureSummary`

- Gives the owner one compact closure reason.
- Cannot create owner authority.
- Cannot be inconsistent while still passing.

## Active Policy Index

The active policy index is intentionally not a P0 artifact. It is a static
source file used to reduce md selection ambiguity.

Task profiles:

- `routine`: AGENTS, manifest, active spec; at most 3 md files and 2 skills.
- `metadata_light`: AGENTS and manifest; at most 2 md files and 1 skill.
- `target_rollout`: AGENTS, manifest, active spec, rollout instruction; at most
  4 md files and 2 skills.
- `harness_source_body`: AGENTS, manifest, active spec; at most 6 md files and 3
  skills.
- `compatibility_repair`: AGENTS, manifest, active spec, failing legacy spec
  only; at most 6 md files and 3 skills.

## Source-Hard Versus Target-Warn

In the Source HARNESS repo, missing v1.2.3 fields, inconsistent closure, missing
selected skill contracts, harmful skill use, raw logs, full history, wrong
workspace, or ineffective high-tier escalation are hard failures.

In target repos before rollout, v1.2.3 fields may be absent. After rollout,
missing observation fields are warnings unless the target profile declares them
hard.

Target rollout must keep a hard/warn split so v1.2.3 does not become a heavy
audit framework by accident.

Target hard failures:

- raw logs read
- wrong workspace during mutation or PR creation
- self approval
- GitHub approval review submitted by an agent
- wallet/RPC/deploy access
- readiness, production, legal, or YouTube policy claim
- wrong profile Skill selected
- Final Decision closure inconsistency

Target warnings:

- skill effectiveness unknown
- review effectiveness unknown
- artifact reuse unavailable
- unobserved declared context
- sameScratchpadAccess unknown

Read-only audits may warn on workspace uncertainty when no mutation, PR creation,
merge, release, deploy, wallet/RPC, or secret action is attempted.

## Self-Test Requirements

`scripts/codex-v123-self-test.mjs` must prove:

- no new P0 artifact
- no new top-level operator-visible status
- v1.1.8 Final Decision authority preserved
- v1.1.9 P0 artifact/status compatibility preserved
- v1.2.0 adaptive routing compatibility preserved
- v1.2.1 calibration compatibility preserved
- v1.2.2 skill/context routing compatibility preserved
- final decision closure contradictions fail
- workspace identity mismatch fails
- active policy index stays bounded
- raw logs and full history reads fail
- legacy spec overread fails
- unobserved declared context warns instead of blocking
- selected skill without contract fails
- selected skill blocked by forbidden repo profile fails
- unknown skill impact fails for Source hard mode
- harmful skill recommendation fails
- non-high-tier escalation with no new signal is neutral
- high tier with no new signal fails
- repeated same root cause after high tier fails unless a new signal appears
- same-worker independent review fails
- sameScratchpadAccess unknown warns instead of blocking
- review loop repeated finding fails
- owner brief cannot create authority

## Safety Line

Source HARNESS v1.2.3 is an evidence and closure improvement only. It is not
runtime readiness, production readiness, legal compliance, YouTube policy
compliance, deployment permission, target rollout, or merge permission.
