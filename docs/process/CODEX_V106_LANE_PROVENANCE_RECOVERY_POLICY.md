<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Codex Harness v1.0.6 Lane, Provenance, and Recovery Policy

v1.0.6 is a source-harness-only reliability layer for operating v1.0.5 safely.
It does not start target rollout, product implementation, runtime work,
deployment, representative real PR validation, or readiness claims.

## Lane Separation

Merge-blocked means merge is blocked. It does not automatically block
explicitly scoped docs-only planning, spec persistence, roadmap recovery, or
common utility planning. Runtime, new runtime integration, merge, and product
implementation lanes remain blocked unless a future task explicitly opens them.
Existing PR lanes are preserve-only.

## Provenance

Safe artifacts must identify the source class for active harness version,
active self-test, registry manifest, PR context, PR body, review evidence,
knowledge governance, target quality score, and reason summary. Allowed source
classes are github_event, github_api, env, safe_artifact,
generated_evidence_pack, current_pr_body, stale_pr_body, absent, and
unavailable.

## Recovery

Safe failures must map to a repair kind and safe next action. Body-only PR body
parser failures must not be reported as product failures. Target quality score
breakdown is authoritative for reason summary so stale optional blockers do not
reappear in final aggregation.

## Bounded Validation

Full target-mode timeout is classified as an evidence limitation, not product
failure. Bounded validation is not merge evidence and must keep merge readiness
as no until same-head remote evidence and review governance requirements are
satisfied.

## Controlled Orchestration

Subagents, subthreads, and thread-to-thread conversation are advisory only.
They cannot create PRs, push, merge, claim readiness, or satisfy independent
human review. Parent thread final authority and verification fan-in are required.

## Product Policy Hooks

VOXWEAVE, IRIS-live2d-renderer, CRIPTO-TIP, FUNKY, and IRIS receive policy
registration hooks only. These hooks do not implement product/runtime behavior
and do not imply readiness.
