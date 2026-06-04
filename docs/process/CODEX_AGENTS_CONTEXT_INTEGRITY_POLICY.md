<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# AGENTS Context Integrity Policy

AGENTS.md is persistent Codex context. It must be short, readable UTF-8 text and safe to load before any task.

Required:
- Exactly one current `CODEX_QUALITY_HARNESS_FILE v1.0.6` harness block.
- Readable project rules may remain outside the harness block.
- Mojibake anywhere in AGENTS.md fails.
- Concrete secret-like values, endpoint values, private paths, raw logs, raw diffs, raw payloads, production data, or personal data fail.

Allowed:
- Safe policy vocabulary such as "do not output endpoint values" when no concrete value is present.

If unreadable project authority is found, stop and ask for owner confirmation instead of inventing rules.
