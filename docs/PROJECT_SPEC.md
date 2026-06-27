# Project Specification

## Current Architecture

HARNESS v1.3.0 Core is the active Source governance layer for `hiro4649/codex-development-harness`. The Source authority remains bound to `v1.1.8_final_decision_kernel`, with v1.3.0 Core active and the v1.3.0 Compatibility Adapter carrying internal compatibility evidence for older target gates.

## Functional Specifications

- Active Source: `activeHarnessVersion=1.3.0`, `activeSelfTestSuite=v130`.
- Performance Track, Fable comparison, SDK / 60-task benchmark, Skill runtime, DAG agent-team runtime, target rollout waves, and v1.3.1 are out of scope.
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

## APIs

No product or runtime APIs are changed. This work only updates Source harness metadata, workflow metadata, and self-test coverage.

## Design Decisions

- The former active-policy `target_rollout` profile is replaced by `target_compatibility_profile_install` to avoid implying active legacy operator authority.
- `docs/process/CODEX_V129_SPEC.md` remains available only as a failing compatibility adapter reference, not active operator surface.
- Core workflow supply-chain posture uses full-SHA pins for checkout and setup-node rather than a floating-action allowance.

## Constraints

- No target repository mutation.
- No product/runtime/package/lockfile/deploy/wallet/RPC/secret mutation.
- No branch protection bypass or required-check bypass.
- No GitHub Actions rerun unless owner explicitly approves after quota/billing constraints are resolved.

## Known Limitations

- Remote main workflow_dispatch validation was not run in this local session because GitHub Actions usage is currently restricted and prior target checks showed account billing lock behavior. Needs verification after owner approval.
