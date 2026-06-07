# Codex Harness v1.1.3 Spec

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.3 -->

## Theme

Minimal Surface, Fast Gates, Typed Decisions, and Compatibility Proof.

v1.1.3 is a source-harness-only release. It does not install target harnesses,
does not touch product repositories, and does not claim runtime or production
readiness.

## Goals

- Keep one canonical evidence source and demote PR body text to rendered output.
- Emit one typed decision object for merge, repair, rollout, readiness, and next
  action decisions.
- Put `codex-minimal-blockers.safe.json` first in the safe artifact read order.
- Split fast gates from long-running gates so obvious blockers fail quickly.
- Keep target rollout surface small through selector manifests and dry-run
  planned/actual parity.
- Preserve target-mode compatibility without turning unrelated legacy self-test
  failures into product repair work.
- Prove five target profiles through synthetic fixtures before any real target
  rollout starts.
- Track conversation/operator cost as a first-class quality signal.

## Required Safe Artifacts

- `codex-minimal-blockers.safe.json`: the first artifact to read after failure.
- `codex-safe-artifact-index.safe.json`: the entry point for decision, blocker,
  reason, score, compatibility, repair, rollout, cost, and install receipt
  artifacts.
- `codex-decision-object.safe.json`: the single typed decision record.
- `codex-conversation-cost-ledger.safe.json`: token and output budget summary.

Artifacts are safe-summary only. They must not contain raw logs, raw diffs, raw
payloads, secrets, endpoints, private paths, or runtime data.

## Gate Contract

The active source self-test is `v113SelfTestStatus`. The previous v1.1.2 self-test
remains a blocking compatibility lane for source main validation.

Fast gate checks include repo identity, branch/head parity, dirty/untracked
state, forbidden paths, manifest version, product touch detection, package or
lockfile touch detection, readiness claims, raw log policy, and active self-test
existence.

Long-running gates must be split from fast failures and may not hide the primary
minimal blocker.

## Target Compatibility Proof

The v1.1.3 fixture matrix covers VOXWEAVE, IRIS-live2d-renderer, FUNKY, IRIS, and
CRIPTO-TIP. Fixtures are synthetic, non-runtime, and non-product. They preserve
known target boundaries such as no TTS runtime, no renderer readiness, no funded
transaction, priority1 BLOCKED, and CRIPTO-TIP TypeScript terminal-block handling.

## Non-Goals

- No target rollout.
- No product code change.
- No runtime implementation.
- No workflow broadening.
- No package or lockfile change.
- No wallet, RPC, deploy, TTS, Live2D, YouTube, DB, or AI runtime access.
- No self-merge without explicit owner instruction.
