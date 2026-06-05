<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Codex Docker Smoke Artifact Policy

Version: v0.9.3

Docker-relevant PRs require a current-head Docker smoke artifact. A workflow_dispatch result is not a substitute for a PR check when the PR changes product-relevant or Docker-relevant files.

## Docker-Relevant Files

Dockerfiles, compose files, docker scripts, workflow changes that affect Docker smoke, backend runtime artifact policy, worker or scheduler Docker entrypoints, and target manifests declaring Docker smoke required all require same-head smoke evidence.

## Blocking Conditions

The gate fails when Docker smoke is required but missing, stale, skipped by fast path or CODEX_SKIP_NPM, failed while quality score passes, or represented only by workflow_dispatch evidence for a product-relevant PR.
