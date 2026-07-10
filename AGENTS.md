# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.3.2

Active local Source candidate: HARNESS v1.3.2 Evidence-Converged Lean Core.
Accepted main: HARNESS v1.3.0 Core at be06232adbe9072456bc9a36a1b298f5ba900470; development parent is the v1.3.1 candidate and execution candidate is v1.3.2.
Candidate lifecycle: local_validated; remote validation and activation are not complete.
Version semantics: activeHarnessVersion is a deprecated execution-compatibility alias with no published authority; acceptedMainVersion is published authority; candidateVersion is unmerged candidate.
Provisional base: v1.3.1 PR head; rebase and exact-head remote validation are required after v1.3.1 merges.
Compatibility Adapter: v1.3.2 internal evidence; debt due now has an explicit disposition.
Source candidate display: HARNESS v1.3.2 Evidence-Converged Lean Core; target installed state is observed per repository and is never inferred from this Source candidate.
Target rollout: not started; Performance deferred.
Final Decision authority: v1.1.8_final_decision_kernel.
Active policy pointer: docs/process/CODEX_HARNESS_MANIFEST.json.
v1.3.2 Core policy pointer: docs/process/CODEX_V132_POLICY.json.
Execution entrypoint: scripts/codex-local-quality-gate.mjs.

Prime Directive: smallest correct change for product value; do not weaken truth, trust, security, or maintainability.

<!-- CODEX_ACTIVE_BLOCK_BEGIN -->
machineBindingId=FD_AUTH: Final Decision is pass/block/mergeAllowed/exit-code authority.
machineBindingId=DC_PROJECTION: Decision Capsule is a non-authoritative domain projection; it cannot authorize merge.
machineBindingId=SAME_HEAD: Same-head required checks must bind observed provider heads.
machineBindingId=SOURCE_TARGET_MODE: Source/target deterministic mode must not infer Source from target files.
machineBindingId=PROCESS_RECEIPT: Process receipt permits edit/check/commit/push/PR/fix_ci only inside scoped provenance.
machineBindingId=PR_BODY_DISPLAY: PR body is human display, never machine evidence.
machineBindingId=RAWLOG_BLOCK: Raw logs, secrets, prompts, and model outputs are forbidden.
machineBindingId=NO_SELF_APPROVAL: AI must not self-approve.
machineBindingId=NO_GH_APPROVAL_REVIEW: AI must not submit GitHub approval review.
machineBindingId=RUNTIME_DEPLOY_WALLET_BOUNDARY: Product/runtime/deploy/wallet/RPC/secret scope is separate.
machineBindingId=STOP_CIRCUIT: repeated architectural blocker stops expansion.
machineBindingId=PROJECTION_NONAUTH: Safe Summary/Projection/Goal/Router/Receipt routine surfaces are non-authoritative.
<!-- CODEX_ACTIVE_BLOCK_END -->

Routine read profile:
- Read this file, docs/process/CODEX_EFFECTIVE_POLICY.compact.json, and the task delta capsule.
- Defer the full manifest to architect audit, manifest conflict, compatibility failure, or release review.
- Defer adapter internals unless rollback, safe artifact, or compatibility failure needs them.
- Routine selected Skill count is 0.
- Routine cold artifact reads are 0.

Architect/reviewer project-memory read order: docs/PROJECT_SPEC.md, docs/PROJECT_STATUS.md, docs/NEXT_TASK.md, docs/CHANGELOG.md, AGENTS.md, docs/process/CODEX_HARNESS_MANIFEST.json.

Core policy:
- HARNESS v1.3.2 is Evidence-Converged Lean Core: typed evidence, canonical state, strict compiled manifests, deterministic incremental validation, bounded context/output, resumable receipts, allowlist target dry-run planning, and CI cost planning.
- Local pass is never remote pass. Missing remote evidence remains `not_observed`; billing lock is unavailable infrastructure, not code failure; only `mergeAllowed` is canonical merge projection.
- Accepted-main trust is a SHA-free document plus a GitHub-observed Source default-branch HEAD/blob/path envelope. Required workflow sets, check app IDs, Ruleset refs, and artifact repository/head/status values are exact bindings.
- Remote collection uses an owner-managed `CODEX_V132_COLLECTOR_TOKEN` only through `scripts/codex-v132-collect-remote-evidence.mjs`; its serialized receipt is non-authoritative and ordinary product workflows must never receive that credential.
- Final Decision remains the authority. Decision Capsule v3 is a bounded non-authoritative projection of canonical state.
- Performance Track covers 60-task benchmark, SDK, Skill runtime, DAG team, learned orchestration, Cyber runtime, and Fable comparison; it is deferred, non-authoritative, and superiority is not proven.
- v1.3.1 is immediate rollback; v1.3.0 secondary rollback; v1.2.9 emergency rollback; v1.2.8 and v1.2.7 remain compatibility evidence.
- Performance Track, target rollout waves, and Skill install remain forbidden unless scoped.
- Target Profile Installer is allowlist-based and dry-run only; this local Source candidate must not mutate target repositories.

Forbidden action classes:
- authority weakening or required-check bypass/removal
- branch protection weakening, direct main push, GitHub approval review
- product/runtime/package/lockfile/target mutation
- deploy/wallet/RPC/secret access
- same-run Skill generation/activation, unlimited retry, agent recursion, or parallel same-file writers

<!-- CODEX_QUALITY_HARNESS_END -->
