---
name: repo-quickcheck
description: Use before finishing any code or documentation change to choose the smallest meaningful verification for the current repository. Do not use for deployment, release, wallet, RPC, or readiness approval.
---

# Repo Quickcheck

Use this skill near the end of a scoped change.

1. Identify the repository and changed file types.
2. Read the repo guidance in `AGENTS.md` and inspect package or tool metadata only as needed.
3. Choose the smallest meaningful verification command for the changed surface.
4. Run the command when dependencies and scripts are available.
5. If dependencies or scripts are unavailable, report that honestly and do not invent a pass.
6. Never treat deployment, release, wallet, RPC, or readiness commands as normal verification.
7. Summarize evidence, skipped checks, and residual risk without raw logs.
