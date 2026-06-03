<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Prompt Governance Policy

Prompt-like files are versioned harness code. Changes to `AGENTS.md`, skills,
PR templates, review policies, schemas, gate policies, and prompt/review scripts
must be protected by deterministic eval fixtures instead of subjective tuning.

The gate is lightweight: no external API, no LLM judge, no GEPA or DSPy
dependency, no network access, no prompt auto-apply, and no product command
execution.

Prompt governance fails when prompt-like changes weaken manual-confirmation
limits, convert product verification failures to pass, enable auto-apply,
auto-commit, or auto-push, or change required prompt surfaces without matching
eval coverage.

Local non-PR runs may report or pass with safe fixture checks. PR context uses
enforce mode and safe summary only.
