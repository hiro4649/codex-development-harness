<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Agent Session Governance Policy

- Multi-agent sessions require explicit repo, branch, worktree, owner, state, allowed scope, and forbidden scope.
- A session in needs_input cannot advance to merge.
- Parallel sessions must not modify the same file or push to the same branch without ownership.

Safe output only: no raw logs, raw diffs, secrets, endpoints, private paths, production data, or personal data. This policy adds no external dependency, LLM judge, MCP, browser, Playwright, AST parser, npm dependency, product command execution, product code change, or runtime readiness claim.
