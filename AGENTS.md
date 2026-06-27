# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.3.0

Active Source: v1.3.0 Core.
Compatibility Adapter: v1.3.0 internal evidence.
Target harness display: HARNESS v1.3.0 Core.
Target rollout: profile-gated; Performance deferred.
Final Decision authority: v1.1.8_final_decision_kernel.
Active policy pointer: docs/process/CODEX_HARNESS_MANIFEST.json.
v1.3.0 Core policy pointer: docs/process/CODEX_V130_POLICY.json.
Execution entrypoint: scripts/codex-local-quality-gate.mjs.

Prime Directive: smallest correct change for product value; do not weaken truth, trust, security, or maintainability.

<!-- CODEX_ACTIVE_BLOCK_BEGIN -->
machineBindingId=FD_AUTH: Final Decision is pass/block/mergeAllowed/exit-code authority.
machineBindingId=DC_AUTH: Decision Capsule is domain decision authority.
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
- Read this file, docs/process/CODEX_HARNESS_MANIFEST.json, and the compiled instruction envelope.
- Defer adapter internals unless rollback, safe artifact, or compatibility failure needs them.
- Routine selected Skill count is 0.
- Routine cold artifact reads are 0.

Architect/reviewer project-memory read order: docs/PROJECT_SPEC.md, docs/PROJECT_STATUS.md, docs/NEXT_TASK.md, docs/CHANGELOG.md, AGENTS.md, docs/process/CODEX_HARNESS_MANIFEST.json.

Core policy:
- Performance Track covers 60-task benchmark, SDK, Skill runtime, DAG team, learned orchestration, Cyber runtime, and Fable comparison; it is deferred, non-authoritative, and superiority is not proven.
- IRIS/FUNKY may resume under HARNESS v1.3.0 Core governance.
- Performance Track, target rollout waves, and Skill install remain forbidden unless scoped.

Forbidden action classes:
- authority weakening or required-check bypass/removal
- branch protection weakening, direct main push, GitHub approval review
- product/runtime/package/lockfile/target mutation
- deploy/wallet/RPC/secret access
- same-run Skill generation/activation, unlimited retry, agent recursion, or parallel same-file writers

<!-- CODEX_QUALITY_HARNESS_END -->
