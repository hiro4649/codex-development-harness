# Project Specification

## HARNESS v1.3.0 Core Purpose

HARNESS v1.3.0 Core is the active Source governance layer for realistic autonomous development. It is meant to be lightweight, stable, token-efficient, long-running, and safe without losing the practical strengths of v1.2.8 or v1.2.9.

## Current Architecture

HARNESS v1.3.0 Core is active for `hiro4649/codex-development-harness`. The Source authority remains bound to `v1.1.8_final_decision_kernel`, with the v1.3.0 Compatibility Adapter carrying internal compatibility evidence for older target gates.

## Source Repo vs Target Repo Boundary

The Source repository defines harness policy, compatibility projection, local quality gates, and operator instructions. Target repositories contain product or target-local code and must not be mutated by Source-only tasks. Target rollout remains separate, owner-scoped, and not implied by Source Core metadata.

## Functional Specifications

- Active Source: `activeHarnessVersion=1.3.0`, `activeSelfTestSuite=v130`.
- Final Decision authority: `v1.1.8_final_decision_kernel`.
- Compatibility Adapter: active, `authority=internal_compatibility_only`.
- `authorityCreated=false`, `targetMutationCount=0`.
- Performance Track, Fable comparison, SDK / 60-task benchmark, Skill runtime, DAG agent-team runtime, target rollout waves, and v1.3.1 are out of scope.
- Performance Track is deferred and non-authoritative.
- Core workflows must carry current v1.3.0 harness markers.
- Core workflow checkout/setup-node actions are pinned to full SHAs.
- Target overlay fields are template-only and must not imply target repository mutation.

## Data Models

- `sourceCoreTargetRolloutState=not_started`
- `installedTargetHarnessVersion=1.2.9`
- `operatorTargetHarnessDisplay=HARNESS v1.3.0 Core`
- `compatibilityAdapterInternalHarnessVersion=1.2.9`
- `targetManifestOverlay.projectionKind=profile_install_template_only`
- `targetManifestOverlay.appliesOnlyAfterOwnerScopedProfileInstall=true`
- `targetManifestOverlay.mutatesTargetRepositories=false`
- `actionPinPolicy.state=active`

## Preserved v1.2.8 Strengths

v1.2.8 strengths are preserved through the v1.3.0 Compatibility Adapter as internal compatibility evidence: deterministic decision projection, token-minimal read, compatibility router, validation DAG / evidence reuse, projection integrity, rollback compatibility, source/head binding, and safe summary non-authority.

## Preserved v1.2.9 Strengths

v1.2.9 strengths are preserved through the v1.3.0 Compatibility Adapter as internal compatibility evidence: goal-contracted capability router, independent verifier, immediate rollback, host dispatch / plugin broker compatibility as non-authoritative internal evidence, real-host qualification discipline, and `v129SelfTestStatus` compatibility where required.

## APIs

No product or runtime APIs are changed. This work only updates Source harness metadata, workflow metadata, and self-test coverage.

## Design Decisions

- The former active-policy `target_rollout` profile is replaced by `target_compatibility_profile_install` to avoid implying active legacy operator authority.
- `docs/process/CODEX_V129_SPEC.md` remains available only as a failing compatibility adapter reference, not active operator surface.
- Core workflow supply-chain posture uses full-SHA pins for checkout and setup-node rather than a floating-action allowance.
- Root project docs are human project memory. `docs/process/*` files are machine policy and compatibility evidence.

## Constraints

- No target repository mutation.
- No product/runtime/package/lockfile/deploy/wallet/RPC/secret mutation.
- No branch protection bypass or required-check bypass.
- No GitHub approval review and no self-approval.
- Raw logs, secrets, prompts, and model outputs are forbidden as stored evidence.
- No GitHub Actions rerun unless owner explicitly approves after quota/billing constraints are resolved.

## Conflict Rule

If root project memory and machine policy disagree, stop and report the conflict. Do not infer authority from project memory when machine policy is stricter.

## Known Limitations

- Remote main workflow_dispatch validation was not run in this local session because GitHub Actions usage is currently restricted and prior target checks showed account billing lock behavior. Needs verification after owner approval.
