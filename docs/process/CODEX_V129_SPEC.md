# CODEX_QUALITY_HARNESS_FILE v1.2.9

# HARNESS v1.2.9: Goal-Contracted Capability Router

v1.2.9 is the active Source harness. It activates Goal Contract, deterministic task classification, capability routing, receipt binding, and independent verifier contracts as load-bearing Source checks. It does not roll out to targets and does not change Final Decision authority.

## Authority

- activeHarnessVersion is `1.2.9`.
- activeSelfTestSuite is `v129`.
- candidateHarnessVersion is `1.2.9`.
- candidateSelfTestSuite is `v129`.
- candidateActivationState is `active`.
- sourceActivation is `active`.
- targetRollout is `not_started`.
- finalAuthority remains `v1.1.8_final_decision_kernel`.
- Final Decision, Decision Capsule, Evidence Capsule, and v1.2.8 safe summary schemas are not replaced.
- v1.2.8 remains blocking compatibility rollback authority.
- v1.2.9 is blocking current active authority.

## Real-Host Qualification

Source activation is bound to a safe receipt generated outside the repository:

- status: `pass`
- qualifiedSourceMainSha: `1b48b20fb911d34141953adc8e8886d3775340be`
- receiptDigest: `sha256:d42c41eb94ed1c4a14e2f4050b1efbaf6464734e97d70b4e568dee276bfa40b4`
- workerModelInvocationObserved: `true`
- verifierModelInvocationObserved: `true`
- workerVerifierDistinctThreads: `true`
- tokenBudgetStatus: `pass`
- pluginSelectionState: `unavailable`
- pluginInvocationObserved: `false`
- pluginQualification: `unavailable_nonblocking`
- authorityCreated: `false`
- safeSummaryOnly: `true`

The repository records only safe metadata and digests. It must not store raw prompt, raw output, credential material, full environment, full logs, local receipt paths, absolute adapter paths, or model IDs as authority.

## Goal Contract

Goal Contract is strict JSON with duplicate-key rejection and unknown-field rejection. The active source marker remains `CODEX_QUALITY_HARNESS_FILE v1.2.8`; v1.2.9 identity is carried only by `candidateHarnessVersion=1.2.9` and `candidateActivationState=source_shadow_candidate`. Required fields:

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

`goalDigest` is computed from canonical JSON after excluding the `goalDigest` field. After a goal starts, a changed digest requires a new `goalVersion` and a new run. Candidate head is not included in the immutable goal digest. Repository identity, base SHA, and scope digest are included in `binding`. `binding.repositoryId` is the positive integer GitHub repository id, not the `owner/name` string.

Contract limits:

- `repairBudget.maxRepairIterations` and `repairBudget.sameBlockerMax` are integers from 0 to 1.
- `desiredEndState` is a non-empty string with a bounded byte length.
- `truthOwnerRefs.path` values are unique.
- `acceptanceCriteria.id` values are unique and complete as `AC1..ACn`.
- all string and array fields have byte/count limits.
- authority-sensitive file classification uses an exact normalized path classifier, not substring guessing.

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
