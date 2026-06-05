# Tool Gap Resolver Policy

CODEX_QUALITY_HARNESS_FILE v1.0.7

Statuses:

- toolGapResolverStatus
- toolUnavailableStatus
- remoteEquivalentEvidenceStatus
- toolGapSafeFallbackStatus
- toolGapDoesNotPassStatus

A missing tool is never pass. Same-head remote equivalent evidence can satisfy a
gap only when it is a safe artifact for the same head. Otherwise the result is
fail or blocked_external with one safe next action.
