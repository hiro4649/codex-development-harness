<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# PR Body Surface Normalizer Policy

The PR body surface normalizer reduces false positives from words such as auth,
runtime, or storage when they appear in forbidden scope, residual risks, or
explicit negations. Changed files still override PR body denials, and runtime
readiness claims still require their normal evidence.

The normalizer only emits safe labels and optional heading hints. It does not
rewrite PR bodies.
