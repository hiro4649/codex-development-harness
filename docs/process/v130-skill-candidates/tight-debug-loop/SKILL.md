---
name: tight-debug-loop
description: Bounded bug repair loop that proves a reproducible failure, tests one hypothesis at a time, and removes instrumentation.
---

# Tight Debug Loop

Use only for `bug_repair` or a confirmed `implementation_defect`.

Steps:
1. Capture the specific symptom and deterministic reproduction rate.
2. State at most three falsifiable hypotheses.
3. Instrument one variable or seam at a time.
4. Add or identify the regression test that fails before the fix.
5. Apply the smallest repair in the goal scope.
6. Re-run the original reproduction and regression test.
7. Remove debug instrumentation before completion.

Completion criteria:
- Reproduction command or gate is agent-runnable with bounded timeout.
- Original failure is red before repair or explicitly known-red.
- Regression test targets the corrected seam.
- Raw output, secrets, and logs are not stored.
- If no red-capable loop can be built, return `auto_quarantine` or `generate_only`.
- No merge, deploy, wallet, RPC, secret, or approval authority is created.
