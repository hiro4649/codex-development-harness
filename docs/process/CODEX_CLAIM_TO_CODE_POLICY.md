# Claim To Code Policy

CODEX_QUALITY_HARNESS_FILE v1.0.4

The harness must not trust claims by default. It extracts deterministic claims
from safe PR body or fixture text, maps each claim to deterministic checks, and
fails unknown or contradicted claims.

Statuses:

- claimToCodeVerifierStatus
- claimExtractionStatus
- claimCoverageStatus
- claimContradictionStatus
- claimEvidenceSourceStatus
- claimSafeSuggestedCheckStatus

Rules:

- Raw logs, raw diffs, secrets, endpoints, wallet addresses, transaction hashes,
  and payloads are forbidden in claim output.
- Same-head remote quality claims require same-head evidence.
- Runtime and production readiness negation claims fail if contradicted by files
  or text.
- Repository-interface claims fail when code directly references forbidden
  repository internals.
- Unknown claims do not pass; they return a safe suggested check.
