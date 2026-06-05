<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Lifeboat Semantics Policy

Lifeboat artifacts are recovery evidence. They do not replace normal safe summaries, target summaries, reason summaries, or product verification evidence.

Allowed:
- normal safe bundle present with standby lifeboat
- lifeboat attached as diagnostic context after a real gate result

Forbidden:
- lifeboat-only pass
- safe bundle missing pass
- hiding a real blocker behind lifeboat semantics
- failing a normal safe bundle only because a standby lifeboat exists
