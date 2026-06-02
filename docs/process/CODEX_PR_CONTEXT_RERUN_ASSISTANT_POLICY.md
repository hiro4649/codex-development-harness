<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# PR Context Rerun Assistant Policy

Rerun guidance must preserve current-head evidence. The assistant may recommend rerunning a same-head failed PR context run, an empty commit for rerun 404, or rebase when main advanced.

Forbidden:
- blind rerun for stale head
- empty commit for product failure
- merge after workflow_dispatch only
- stale PR body head SHA after refresh
