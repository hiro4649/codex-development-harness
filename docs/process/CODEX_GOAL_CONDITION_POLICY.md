<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Codex Goal Condition Policy

Version: v0.9.3

Long-running harness work must declare a measurable goal condition before it claims completion. The gate checks goal, measurable end state, proof command, must-not-change list, stop condition, and max scope.

## Required Fields

- goal
- measurableEndState
- proofCommand
- mustNotChange
- stopCondition
- maxScope

The goal must stop at the requested scope and must not start the next task before proof is complete.
