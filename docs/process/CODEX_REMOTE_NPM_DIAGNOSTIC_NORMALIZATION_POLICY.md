<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Remote NPM Diagnostic Normalization Policy

Remote npm diagnostics must follow the formal remote product evidence result. A passing remote npm execution must not be reported as not executed.

Pass requires:
- npm was executed when product relevant
- npm exit code is zero
- formal product evidence and remote baseline pass
- diagnostic is pass or superseded by formal evidence

Fail remains fail for missing execution, npm failure, pending final diagnostics, or false not-executed reason codes.
