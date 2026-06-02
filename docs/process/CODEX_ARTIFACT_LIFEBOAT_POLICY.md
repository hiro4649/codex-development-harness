CODEX_QUALITY_HARNESS_FILE v1.0.4

# Codex Artifact Lifeboat Policy

The workflow must create a minimal safe failure artifact before checkout,
setup-node, dependency installation, repository scripts, and the quality gate.
The pre-checkout artifact is generated with shell only and may be refreshed by
the Node lifeboat helper later. The artifact records only phase, last known gate,
safe reason codes, and a short next action.

The lifeboat never changes a failing gate to pass. It exists so remote failures
remain recoverable when the full quality summary cannot be produced.

The artifact must not contain raw logs, raw diffs, raw payloads, endpoint values,
private paths, production data, personal data, tokens, or secrets.
