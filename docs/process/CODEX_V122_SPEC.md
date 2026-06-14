# Codex Harness v1.2.2

Context-Aware Skill Routing and Read Budget Discipline

Subtitle: Read Less, Preserve Authority

## Authority

v1.2.2 is a Source HARNESS body update only. v1.1.8 Final Decision remains the
only final pass/block/mergeAllowed/exit-code authority. v1.1.9 remains the
orchestration/proof artifact layer. v1.2.0 adaptive routing and review pool
contracts remain compatible. v1.2.1 calibration guard and evidence freshness
contracts remain compatible.

v1.2.2 must not start target rollout, modify target repositories, touch product
code, touch package or lockfiles, touch runtime code, change workflows, claim
runtime readiness, claim production readiness, claim legal compliance, claim
YouTube policy compliance, read raw logs, use 8-session, access
wallet/RPC/deploy paths, self-approve, submit GitHub approval review, add new
Skills, add new P0 safe artifacts, or add new top-level operator-visible
statuses.

## Design Goal

v1.2.2 extends model routing discipline to context routing. The harness should
not make an agent stronger by making it read everything. It should make the
agent more reliable by ensuring it reads the active authority first, reads
conditional material only when justified, and records both the read and
non-read decisions.

The goal is not "never read." The goal is:

- read only what is needed
- record why it was read
- record why deferred material was not read
- always preserve the active authority tuple
- prefer safe artifact pointers over full history

## Artifact Contract

v1.2.2 preserves the v1.1.9 P0 artifact set exactly:

- `codex-orchestration-capsule.safe.json`
- `codex-worker-proof.safe.json`
- `codex-owner-decision-brief.safe.json`

v1.2.2 preserves the v1.1.9 operator-visible status surface exactly:

- `orchestrationModeStatus`
- `permissionGrantStatus`
- `localRepoReadinessStatus`
- `workerContractStatus`
- `workerProofStatus`
- `reviewChainStatus`
- `ownerDecisionBriefStatus`
- `finalDecisionPointerStatus`

All v1.2.2 additions are internal fields in existing artifacts. The primary
addition is `skillContextRouting` inside `codex-orchestration-capsule.safe.json`.

## Skill Context Routing

`skillContextRouting` records machine-only context selection:

```json
{
  "schemaVersion": "1.2.2",
  "taskProfile": "routine",
  "selectedSkills": [],
  "rejectedSkills": [],
  "mdFilesRead": [],
  "mdFilesRejected": [],
  "requiredFirstReads": [
    "AGENTS.md",
    "docs/process/CODEX_HARNESS_MANIFEST.json",
    "docs/process/CODEX_V122_SPEC.md"
  ],
  "deferredReads": ["README.md", "legacy_specs", "pr_history_docs"],
  "forbiddenReads": ["raw_logs", "full_history_without_scope"],
  "actualReadObserved": [],
  "declaredContextUse": [],
  "ownerProvidedContext": {
    "present": false,
    "countedAsFileRead": false
  },
  "safeArtifactPointerUse": {
    "used": false,
    "pointerOnly": true
  },
  "readBudgetStatus": "pass",
  "safeNextAction": "one_action"
}
```

The field must distinguish:

- `actualReadObserved`: tool-visible file or safe artifact reads
- `declaredContextUse`: context the agent says it used
- `ownerProvidedContext`: text supplied by the owner in chat, not counted as a
  file read
- `safeArtifactPointerUse`: pointer-first evidence use

## Active Authority Tuple

Every v1.2.2 capsule must preserve:

```text
AGENTS marker: CODEX_QUALITY_HARNESS_FILE v1.2.2
manifest activeHarnessVersion: 1.2.2
activeSelfTestSuite: v122
active spec path: docs/process/CODEX_V122_SPEC.md
final authority pointer: v1.1.8_final_decision_kernel
```

Context reduction must never remove the active authority tuple.

## Read Order

Default read order:

1. `AGENTS.md`
2. `docs/process/CODEX_HARNESS_MANIFEST.json`
3. active spec only: `docs/process/CODEX_V122_SPEC.md`
4. repo profile or selected Skill only when task profile requires it
5. legacy spec only on compatibility failure or authority conflict
6. PR history only through a safe artifact pointer

README is not a routine read. README may be read when the user asks for a
README task, the repo is new and needs orientation, a metadata-light repo lacks
manifest detail, README itself is changed, or a safe artifact pointer references
README.

## Task Profile Budgets

Read budgets are task-profile specific, not fixed globally:

```text
routine: mdFilesReadMax 3, selectedSkillsMax 2
metadata_light: mdFilesReadMax 2, selectedSkillsMax 1
target_rollout: mdFilesReadMax 4, selectedSkillsMax 2
incident_triage: mdFilesReadMax 5, selectedSkillsMax 3
harness_source_body: mdFilesReadMax 6, selectedSkillsMax 3
compatibility_repair: mdFilesReadMax 6, selectedSkillsMax 3
```

These budgets are upper bounds owned by the task profile. Callers must not
raise `selectedSkillsMax` or `mdFilesReadMax` through input fields. A budget
override attempt is a v1.2.2 validation failure. A task that needs more context
must change to the correct task profile or stop with a typed blocker; it must
not inflate the current profile budget.

A third Skill is allowed only when the task profile permits it, typed
justification is present, token budget remains pass, and `safeNextAction`
remains `one_action`.

## Skill Misfire

`skillMisfireDetected` is true when a selected Skill is forbidden for the repo
profile, matches its `when_not_to_use` condition, requires product scope while
the task is harness metadata-only, requires runtime scope while runtime is not
allowed, conflicts with restricted-asset profile, or recommends a forbidden
action.

Skills should expose:

```text
when_to_use
when_not_to_use
max_context_tokens
allowed_repo_profiles
forbidden_repo_profiles
safe_output_limit
artifact_pointer_first
raw_logs_forbidden
owner_decision_boundary
```

## Read Budget Status

`readBudgetStatus` is one of:

- `pass`: within budget
- `warn`: small overread with typed justification
- `blocked`: hard context violation or unjustified overread

Hard blockers include raw log reads, full history reads without scope, wrong
profile Skill, and legacy spec overread that creates active-authority conflict.

Source HARNESS body work treats v1.2.2 context discipline as a hard condition.
Target repos may start with advisory/warn behavior except for hard blockers.

## Self-Test

`scripts/codex-v122-self-test.mjs` is the active self-test. It must pass with
v121, v120, v119, and v118 compatibility preserved. Local Source gate must
report `v122SelfTestStatus: pass`, `v121SelfTestStatus: pass`,
`v120SelfTestStatus: pass`, `v119SelfTestStatus: pass`, `v118SelfTestStatus:
pass`, and qualityScore 100 before a Source v1.2.2 PR can be considered for
owner merge decision.
