<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Safe Trace Policy

Trace capture is optional in v0.8.2. If trace JSONL files exist under
`.codex/experience/traces/`, each event must contain only safe summary fields
and `rawValuesStored: false`. The harness does not auto-capture traces.
