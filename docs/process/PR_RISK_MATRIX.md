<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# PR Risk Matrix

## R1 low risk

Small text, style, docs, or isolated non-critical UI changes.

Required gates: local quality gate, PR template, one implementation review.

## R2 medium risk

Feature changes, API changes, data validation, non-critical persistence, or shared component changes.

Required gates: local quality gate, spec review, test coverage review, implementation review.

## R3 high risk

Authentication, authorization, payments, assets, secrets, production configuration, database migrations, external side effects, infrastructure, rollout behavior, or critical product flows.

Required gates: local quality gate, spec review, test coverage review, implementation review, release-gate review, human approval, rollback plan.
