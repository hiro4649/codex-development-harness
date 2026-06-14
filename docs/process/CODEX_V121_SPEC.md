# Codex Harness v1.2.1

Adaptive Routing Metrics and Evidence Calibration Guard

## Authority

v1.2.1 is a Source HARNESS body update only. v1.1.8 Final Decision remains the
only final pass/block/mergeAllowed/exit-code authority. v1.1.9 remains the
orchestration/proof artifact layer. v1.2.0 adaptive routing and review pool
contracts remain compatible and are not replaced.

v1.2.1 must not start target rollout, modify target repositories, touch product
code, touch package or lockfiles, touch runtime code, claim runtime readiness,
claim production readiness, claim legal compliance, claim YouTube policy
compliance, read raw logs, use 8-session, access wallet/RPC/deploy paths,
self-approve, submit GitHub approval review, add new P0 safe artifacts, or add
new top-level operator-visible statuses.

## Artifact Contract

v1.2.1 preserves the v1.1.9 P0 artifact set exactly:

- `codex-orchestration-capsule.safe.json`
- `codex-worker-proof.safe.json`
- `codex-owner-decision-brief.safe.json`

v1.2.1 preserves the v1.1.9 operator-visible status surface exactly:

- `orchestrationModeStatus`
- `permissionGrantStatus`
- `localRepoReadinessStatus`
- `workerContractStatus`
- `workerProofStatus`
- `reviewChainStatus`
- `ownerDecisionBriefStatus`
- `finalDecisionPointerStatus`

All v1.2.1 additions are internal fields in those existing artifacts.

## Orchestration Capsule Additions

`adaptiveMetrics` records bounded, safe-summary-only counters:

- model tier counts, highest-tier usage, escalation/de-escalation counts
- repair iteration count, owner question count, safe artifact read count
- final report line count and repeated context suppression class
- calibration target warnings for safe artifact reads, final report lines, and
  owner questions without adding operator-visible statuses

`routingCalibration` detects over-escalation and unjustified highest-tier use.
Highest-tier routing requires a typed blocker plus safe-summary-only
escalation evidence. A non-`none` escalation reason without a typed blocker is
not valid v1.2.1 calibration.

`targetScoreBaseline` prevents score-only repair churn. A target repo that has
the accepted baseline score and same-head remote pass must not require repair
only to chase a higher cosmetic score.

`evidenceFreshnessGuard` records same-head, safe summary, and merge evidence
coherence. Workflow success requires a passing safe summary view; drift must
be recorded and blocks merge claims until refreshed.

`minimalReverificationMatrix` records which checks need rerun after a state
delta. Routine reruns are required only when head, artifacts, or required safe
evidence changes.

## Worker Proof Additions

`rootCauseSignature` and `repairLoopMetrics` stop repeated repair loops. The
same root cause or same primary class repeated twice requires stop or genuinely
new evidence.

`highTierPlanOutcome` records whether highest-tier review reduced the loop and
returned work to a normal worker. It must not create owner authority.

`reviewerCalibration` records reviewer count and over-review detection without
creating approval authority.

`boundaryDiffClassification` separates metadata-only, harness, workflow,
product, runtime, package, lockfile, and restricted-asset changes. v1.2.1 body
work must stay in metadata/harness scope.

`claimLint` rejects readiness, production, legal, YouTube policy, deploy, merge
ready, or unsafe claims unless a future owner-scoped harness version explicitly
adds such authority.

## Owner Decision Brief Additions

`ownerBurdenMetrics` records owner question count and remaining owner-only
choices. Routine final reports should reduce owner burden and keep choices
bounded to three.

`decisionCompressionMetrics` records final report line count, safe artifact
read count, count-only pass status behavior, silent routine progress, and
target-exceeded flags for routine 14-line and four-safe-artifact goals.

`mergeDecisionIntegrity` records that merge requires owner decision, same-head
remote evidence, and Final Decision compatibility. It also records no self
approval and no GitHub approval review submission.

## Self-Test

`scripts/codex-v121-self-test.mjs` is the active self-test. It must pass with
v120, v119, and v118 compatibility preserved. Local Source gate must report
`v121SelfTestStatus: pass` and qualityScore 100 before a Source v1.2.1 PR can
be considered for owner merge decision.
