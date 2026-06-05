<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Open PR Hygiene Policy

Open PR hygiene is report-only by default.

Rules:
- Never close PRs.
- Never post comments unless explicitly requested.
- Flag stale base, stale evidence, stale confirmation, old harness version, product-file overlap, harness-file overlap, rebase need, and owner-decision need.
- Blocking is allowed only when the current PR depends on stale evidence or overlaps the same harness-managed files with an incompatible base.
- Recommendations are safe labels only: `keep_open`, `refresh_required`, `close_candidate`, `blocked_until_baseline`, or `owner_decision_required`.
- Do not hardcode project PR numbers in source harness logic.
