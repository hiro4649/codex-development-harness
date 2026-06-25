---
name: vertical-tdd
description: One observable behavior slice at a time, requiring red-before-green evidence and no speculative horizontal batching.
---

# Vertical TDD

Use only for `code_change` tasks with new observable behavior.

Steps:
1. Name the public interface and user-observable behavior.
2. Add one focused test for the next behavior slice.
3. Confirm the test fails for the intended reason before implementation.
4. Implement the minimum code to turn the slice green.
5. Re-run the focused test and relevant regression suite.
6. Move to the next slice only after green.

Completion criteria:
- Each required criterion maps to a behavior test or existing invariant gate.
- Red-state refactor is forbidden.
- Horizontal batch test generation is forbidden.
- Snapshot-only or mock-only completion is forbidden.
- Existing passing tests remain passing.
- No merge, deploy, wallet, RPC, secret, or approval authority is created.
