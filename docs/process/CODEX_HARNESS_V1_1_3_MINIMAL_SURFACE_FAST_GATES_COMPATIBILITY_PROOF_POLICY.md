# Codex Harness v1.1.3 Minimal Surface Policy

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.3 -->

## Policy

v1.1.3 reduces rollout and operator surface by making the machine decision small,
typed, and artifact-backed. A long PR body, broad copied harness tree, or
legacy-test wall of text is not authoritative evidence.

## Evidence Single Source

The canonical machine source is `.codex/evidence-pack.json`. Derived artifacts
must record source reference and hash parity. PR body content is only rendered
output; it cannot override evidence-pack decisions.

## Minimal Blockers First

On failure, the operator reads `codex-minimal-blockers.safe.json` first. It may
include only:

- merge blocking state
- up to three primary blockers
- up to five derived failures
- in-scope fixability
- out-of-scope blockers
- one safe next action
- evidence source

Raw logs are forbidden in blocker artifacts.

## Typed Decision Object

The decision enum is:

- `allowed`
- `blocked_by_safety`
- `blocked_by_required_check`
- `blocked_by_scope`
- `blocked_by_missing_safe_artifact`
- `blocked_by_state_delta_required`
- `blocked_by_target_compatibility`
- `advisory_only`
- `not_applicable`

Contradictions fail closed. Examples include allowed merge with failed required
checks, high score with hard blockers, readiness claim drift, target rollout
completion without main verification, or treating quality-gate pass as a
substitute for required checks.

## Legacy And Target Compatibility

Unrelated legacy self-test failures are advisory compatibility unless the reason
code is a true blocker or the lane is source-harness/workflow work. True blockers
such as secret leaks, unsafe output, product code changes, package or workflow
weakening, readiness claims, wallet/RPC/deploy access, self approval, self merge,
8-session default violation, or dirty product files remain blocking.

## Target Scope Firewall

Child process cwd and script path must stay inside the repository. External
workspace processes are blocked. Timeouts must clean child process trees. Raw
command bodies are not evidence.

## Minimal Target Surface

Target rollout uses a selector manifest instead of broad copying. Each file must
have a tier and a why-this-file reason. Dry-run planned/actual parity is required
before target installation.

## Cost And Over-Engineering

The operator-visible status budget is seven visible statuses and three visible
reason codes by default. New docs are capped at three for this source release,
and new scripts are capped at five. Wrapper scripts must reduce output or
generate a decision value.

## Safe Next Action

If all source gates pass, open one source PR and wait for same-head remote
quality-gate metadata. Do not self-merge without explicit owner instruction.
