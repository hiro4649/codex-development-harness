<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# OpenAI Codex Method Policy

This policy makes the OpenAI Codex development method a merge requirement, not a suggestion.

## Required Task Shape

Codex work must be described in a GitHub Issue style before it is treated as merge-ready.

A pull request body must include:

- Goal
- Context
- Constraints
- Done when
- Files or scope
- Plan-first status
- Environment setup
- Testing and review
- Residual risks
- Best of N used or skipped
- Code review status
- Human confirmation needed

## Plan-First Rule

Plan-first is required for large, R3, implementation, dependency, migration, refactor, release, security, multi-file, or ambiguous work.

Best of N is optional, but the PR must state whether it was used or skipped with a reason. It is recommended when multiple plausible solutions exist, especially for architecture, ambiguous, risky, or migration work.

Code review status must show review evidence, such as self-review against docs/process/code_review.md, manual review, or not-required-with-reason.

Human confirmation needed must be explicit: yes, no, required, or not-required-with-reason.

Task queues may be used as lightweight backlog notes, but they are not merge-ready evidence by themselves.

## Durable Method Governance

AGENTS.md should stay short and practical. Repeated mistakes should graduate into AGENTS.md, a skill, or policy only after they are proven durable.

Reviews should use docs/process/code_review.md as the review basis.

Automation should be added only after the manual workflow is stable.

MCP and external tools should be used only when the required context is outside the repository.

Sandbox and approval choices should follow least privilege.

## Safe Output

Do not output secrets, endpoint values, private paths, raw logs, raw payloads, or raw diffs.

CI must not mark a pull request merge-ready when the method gate fails.
