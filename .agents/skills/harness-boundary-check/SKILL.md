---
name: harness-boundary-check
description: Use when editing AGENTS.md, docs/process, manifests, safe evidence scripts, quality gates, or harness metadata.
---

# Harness Boundary Check

Use this skill before finishing edits to harness doctrine, manifests, safe evidence scripts, quality gates, or harness metadata.

1. Identify whether the work is source harness work, target harness rollout work, or repo-local documentation work.
2. Check source-vs-target boundaries and confirm target rollout is explicitly in scope before touching downstream repos.
3. Verify version, manifest, schema, marker, and active self-test consistency.
4. Confirm product code, runtime code, package files, lockfiles, and workflow changes are excluded unless explicitly authorized.
5. Preserve safe-output rules: no raw logs, raw diffs, secrets, endpoints, private paths, raw payloads, production data, or personal data.
6. Require current-head evidence before merge-ready or rollout-complete claims.
7. Report the smallest residual blocker and one safe next action.
