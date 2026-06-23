# CODEX_QUALITY_HARNESS_FILE v1.2.9

# HARNESS v1.2.9: Goal-Contracted Capability Router

v1.2.9 is a Source shadow candidate. It does not activate Source v1.2.9, does not roll out to targets, and does not change v1.2.8 active authority.

## Authority

- activeHarnessVersion remains `1.2.8`.
- activeSelfTestSuite remains `v128`.
- candidateHarnessVersion is `1.2.9`.
- candidateSelfTestSuite is `v129`.
- candidateActivationState is `source_shadow_candidate`.
- sourceActivation is `forbidden`.
- targetRollout is `forbidden`.
- finalAuthority remains `v1.1.8_final_decision_kernel`.
- Final Decision, Decision Capsule, Evidence Capsule, and v1.2.8 safe summary schemas are not replaced.

## Goal Contract

Goal Contract is strict JSON with duplicate-key rejection and unknown-field rejection. Required fields:

- `goalId`
- `goalVersion`
- `taskClass`
- `truthOwnerRefs`
- `desiredEndState`
- `acceptanceCriteria`
- `constraints`
- `nonGoals`
- `allowedFiles`
- `forbiddenFiles`
- `evidencePlan`
- `killCriteria`
- `repairBudget`
- `binding`
- `goalDigest`

`goalDigest` is computed from canonical JSON after excluding the `goalDigest` field. After a goal starts, a changed digest requires a new `goalVersion` and a new run. Candidate head is not included in the immutable goal digest. Repository identity, base SHA, and scope digest are included in `binding`.

## Task Classifier

Task classification is deterministic. A model may not self-declare or upgrade `taskClass` or `difficulty`.

Task classes:

- `routine_metadata`
- `repository_discovery`
- `code_change`
- `bug_repair`
- `architecture`
- `migration`
- `security_scan`
- `security_remediation`
- `runtime_sensitive`
- `restricted_asset`
- `authority_change`
- `target_rollout`
- `research`

Difficulty:

- `low`
- `medium`
- `high`
- `critical`

Priority order:

`authority_change`, `restricted_asset`, `runtime_sensitive`, `security_remediation`, `security_scan`, `migration`, `architecture`, `target_rollout`, `bug_repair`, `code_change`, `routine_metadata`, `repository_discovery`, `research`.

Critical conditions include authority change, security boundary, runtime boundary, restricted asset, wallet/RPC/deploy/secret boundary. High conditions include cross-repo work, migration, architecture, multiple dependent modules, recurring failure, and evidence contradiction.

## Token Budget

The v129 shadow profile uses:

- required reads: `AGENTS.md`, `CODEX_SOURCE_HARNESS_MANIFEST.json`, `docs/process/CODEX_V129_SPEC.md`
- `mdFilesReadMax`: 4
- `selectedSkillsMax`: 1
- `routineColdArtifactReadMax`: 0
- full history: forbidden
- raw logs: forbidden

## Non-Goals

v1.2.9 does not add P0 artifacts, top-level operator statuses, Skills, raw prompt storage, raw model output storage, raw log storage, merge authority, deployment authority, wallet/RPC authority, target repository mutation, or target rollout.
