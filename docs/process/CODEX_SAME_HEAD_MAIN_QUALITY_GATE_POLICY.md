<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Same-Head Main Quality Gate Policy

Main evidence is valid only when the remote quality-gate success head SHA equals the current main head SHA.

Workflow dispatch evidence is main evidence only for the exact same head, not a substitute for PR evidence.
