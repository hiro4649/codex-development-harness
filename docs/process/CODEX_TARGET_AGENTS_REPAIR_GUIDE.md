<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Target AGENTS Repair Guide

When target AGENTS.md contains mojibake, do not preserve unreadable text as working context.

Use this rule:
- If unreadable text is known legacy harness residue, replace it with the current concise harness block.
- If unreadable text appears to encode project authority, stop and ask for owner confirmation.
- Do not guess domain-specific rules from corrupted text.
- Do not delete recoverable project authority.
- If authority cannot be recovered, add a safe stop condition and point to the canonical authority document.

Keep repaired context short, readable, and safe summary only.
