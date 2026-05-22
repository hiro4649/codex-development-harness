# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v0.7.0
## Codex Quality Harness

すべてのCodex作業は、最小差分、証拠ベース、PR前検証を必須とする。

実装前に、目的、非目的、受け入れ条件、テスト計画、残リスクを短く確認する。

仕様、テスト、実装、リリースのレビュー観点は docs/process/skills を参照する。

PR前に scripts/codex-local-quality-gate.sh を実行する。失敗、未実行、スキップはPR本文に明記する。

secret、private key、token、DB URL、raw production log、raw payloadを出力、保存、commitしない。

無関係なリファクタ、依存追加、命名整理、広範囲変更を混ぜない。

## Generic Project Rule

新規プロジェクトでは、最初にREADME、package設定、テストコマンド、CIゲート、PRテンプレートを揃えてから機能実装に入る。

不明な要件は勝手に補完せず、仮定としてPR本文に残す。

プロジェクト固有の仕様権威、禁止事項、テストコマンドがある場合は、AGENTS.mdに明記してからCodex実装に入る。

## HARNESS Authority

HARNESS repoではIRIS_SPEC_AUTHORITY.mdを要求しない。

共通workflow docs整備では docs/codex/AUTHORITY_POLICY.md を確認する。

project固有仕様を変更する場合だけ、そのproject別authorityを確認する。

R3変更はhuman review必須。.env.example変更は専用判断とする。

完了報告では変更ファイル、検証結果、残リスクを明記する。

## OpenAI Codex Method Rule

Use `docs/process/CODEX_TASK_BRIEF_TEMPLATE.md` for non-trivial tasks.
For complex, ambiguous, R3, security, migration, dependency, release, or multi-file work, plan before coding.
PRs must satisfy `docs/process/CODEX_OPENAI_CODEX_METHOD_POLICY.md`.
Reviews should use `docs/process/code_review.md`.
Do not claim merge readiness unless method gate, quality gate, and required checks pass.

<!-- CODEX_QUALITY_HARNESS_END -->
