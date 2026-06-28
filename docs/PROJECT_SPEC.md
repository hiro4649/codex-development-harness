# Project Specification

## HARNESS v1.3.1 Operational Convergence Core Purpose

HARNESS v1.3.1 Operational Convergence Core is the active Source governance layer for reducing operational mistakes. It is not a capability expansion track. Its purpose is to make the harness harder to misuse across local work, remote CI state, target profile planning, and compatibility debt handling.

## Current Architecture

The Source repository `hiro4649/codex-development-harness` now declares `activeHarnessVersion=1.3.1` and `activeSelfTestSuite=v131`. The Final Decision authority remains `v1.1.8_final_decision_kernel`. v1.3.0 remains immediate rollback, and v1.2.9 remains immediate rollback compatibility through the Compatibility Adapter.

## Source Repo vs Target Repo Boundary

The Source repository defines harness policy, compatibility projection, local quality gates, operator instructions, and v1.3.1 convergence checks. Target repositories are not mutated by this Source body work. Target rollout remains separate and has not started from v1.3.1.

## Functional Specifications

- Active Source: `activeHarnessVersion=1.3.1`, `activeSelfTestSuite=v131`.
- Final authority: `v1.1.8_final_decision_kernel`.
- Compatibility Adapter: active, internal-only, non-authoritative.
- v1.3.1 gate order: Workspace Identity Gate, Manifest Strict Validator, Validation State Machine, Target Profile Drift Linter, Remote CI Cost Gate, Decision Capsule v2, Compatibility Debt Ledger, Target Profile Installer Dry Run, Product Value Return Gate advisory.
- Validation State Machine precedes Remote CI Cost Gate.
- Compatibility Debt entries require `mustReviewBefore`.
- Product Value Return Gate is advisory and nonblocking.
- Target Profile Installer is dry-run only.
- Remote CI Cost Gate must not treat remote-pending or billing-blocked checks as remote pass.
- Remote CI Cost Gate and Decision Capsule v2 must expose `remoteRequiredChecksPassed=false`, `mergeAllowed=false`, and `requiredCheckBypassAllowed=false` until remote validation has actually passed and merge readiness is `merge_ready`.

## Data Models

- `v131SelfTestStatus`
- `v131OperationalConvergenceCore`
- `validationStateMachine`
- `remoteCiCostGate`
- `decisionCapsuleV2`
- `compatibilityDebtLedger`
- `targetProfileInstallerDryRun`
- `productValueReturnGate`

Compatibility debt entry shape:

```json
{
  "state": "pass_with_compatibility_debt",
  "reason": "legacy target gate shape preserved",
  "introducedIn": "1.3.0",
  "mustReviewBefore": "1.3.2",
  "affectsAuthority": false,
  "blocking": false
}
```

## APIs

No product or runtime APIs are changed. v1.3.1 adds Source harness scripts and policy/spec metadata only.

## Design Decisions

- v1.3.1 focuses on operational convergence: correct repo, correct manifest, correct state classification, correct target profile wording, and bounded operator output.
- It does not start Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, target rollout, or v1.3.2.
- It does not create merge authority outside Final Decision.
- It keeps PR/target installer behavior dry-run or metadata-only until a separate rollout task explicitly authorizes target work.

## Constraints

- No target repository mutation from this Source body task.
- No product/runtime/package/lockfile/deploy/wallet/RPC/secret mutation.
- No branch protection bypass or required-check bypass.
- No GitHub approval review and no self-approval.
- Raw logs, secrets, prompts, and model outputs are forbidden as stored evidence.
- GitHub Actions must not be used while account/billing lock remains.

## Known Limitations

- Remote CI for v1.3.1 has not run because Actions are currently unavailable.
- Target repositories have not received v1.3.1.
- Other AI evaluation from GitHub will require a future push/PR after remote CI usage is allowed.
