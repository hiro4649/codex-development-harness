<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Codex Security Lifecycle Policy

v0.9.2 applies deterministic, lightweight security lifecycle checks at edit, turn, and commit boundaries. The default gate uses local patterns only and does not require an external LLM judge, MCP, browser, Playwright, AST parser, or product command execution.

The gate fails for unjustified workflow permission escalation, secret-shaped values, product auth or security changes without an oracle, dangerous eval or exec patterns, runtime entrypoint changes without verification, or invalid lifecycle policy files.
