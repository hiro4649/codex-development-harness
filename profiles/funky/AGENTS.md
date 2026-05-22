# AGENTS.md

## 最重要ルール

このリポジトリは暗号資産サービス DISCO.fan / FUNKY.fan の修繕用リポジトリです。

.env、秘密鍵、seed phrase、API key、DB接続情報、JWT secret、本番ログ、本番DB dumpを表示、作成、保存、コミットしてはいけません。

mainへ直接pushしてはいけません。
すべての修正は小さいPRで行ってください。

## FUNKY Authority Docs

FUNKY repoで作業する場合、Codexは作業前に以下を読んでください。

AGENTS.md
docs/process/FUNKY_SPEC_AUTHORITY.md
docs/process/FUNKY_RELEASE_GATE.md
docs/process/FUNKY_ASSET_OPERATION_RUNBOOK.md
docs/process/FUNKY_KNOWN_RISKS.md
docs/process/CODEX_PR_REVIEW_PLAYBOOK.md
docs/process/CODEX_POST_MERGE_CHECKLIST.md

staging反映、runtime障害、secret漏洩、tx失敗、rollback判断が関係する場合は追加で以下を読んでください。

docs/process/CODEX_INCIDENT_AND_ROLLBACK_RUNBOOK.md

優先順位:

1. docs/process/FUNKY_SPEC_AUTHORITY.md
2. docs/process/FUNKY_RELEASE_GATE.md
3. docs/process/FUNKY_ASSET_OPERATION_RUNBOOK.md
4. docs/process/FUNKY_KNOWN_RISKS.md
5. docs/process/CODEX_PR_REVIEW_PLAYBOOK.md
6. docs/process/CODEX_POST_MERGE_CHECKLIST.md
7. docs/process/CODEX_INCIDENT_AND_ROLLBACK_RUNBOOK.md
8. AGENTS.md
9. 個別タスク指示
10. 既存docs/launch

矛盾がある場合は推測で進めないでください。
古いdocsを正としないでください。
authority docsに従い、必要ならdocs更新PRを提案してください。

## 現在のフェーズ

現在はBSCローンチ前のP0修繕フェーズです。
追加監査を広げすぎず、P0修正を優先してください。

1回の作業では1つの問題だけを扱ってください。
関係ないリファクタリング、命名整理、UI変更、依存更新を混ぜないでください。

## 修正対象

主な修正対象は以下です。

apps/backend
apps/frontend
contracts

docs/server-evidence はサーバ証跡です。
legacy や var-www 系がある場合、それは原則として確認用であり、主修正対象ではありません。

## 必須の考え方

資産、NFT、FanPoint、ticket、tier、送金、admin権限に関わる処理では、所有者確認、認証、認可、transaction、idempotency、二重実行防止を必須にしてください。

on-chain状態に関わる処理では、DB更新だけで完了扱いにしてはいけません。
chainId、contract address、txHash、receipt、event log、owner状態を確認してください。

Math.random を資産系抽選、ticket code、NFT、FanPoint付与に使ってはいけません。
crypto.randomInt または crypto.randomBytes を使ってください。

## PR本文に必ず書くこと

修正した問題
変更ファイル
修正理由
追加したテスト
実行したコマンド
成功した結果
残リスク
人間が確認すべき点

## 禁止

大規模な一括修正
mainへの直接push
秘密情報の表示
本番値の仮定
テストなしのproduction ready宣言
関係ないP1/P2修正の混入

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
<!-- CODEX_QUALITY_HARNESS_FILE v0.7.0 -->
## Codex Quality Harness

Use the repo-local harness files in `docs/process/` and `scripts/codex-*`.
Run the secret scan and local quality gate before reporting merge readiness.
R3 or human-review-required changes need manual confirmation for the current head.
Manual confirmation cannot override secret scan failures, blocked paths, high-confidence secrets, implementation/harness mixing, or profile-required failures.

## Funky Asset Safety Rule

資産、NFT、FanPoint、ticket、tier、送金、wallet、admin権限、contract、staging envに触れる変更はR3扱いにする。
R3変更では、認証、認可、所有者確認、chainId、contract address、txHash、receipt、event log、idempotency、二重実行防止、rollbackを必ず確認する。
DB更新だけでon-chain成功扱いにしない。
tBNB未入金、staging未反映、receipt未確認の状態をproduction readyと書かない。

## OpenAI Codex Method Rule

Use `docs/process/CODEX_TASK_BRIEF_TEMPLATE.md` for non-trivial tasks.
For complex, ambiguous, R3, security, migration, dependency, release, or multi-file work, plan before coding.
PRs must satisfy `docs/process/CODEX_OPENAI_CODEX_METHOD_POLICY.md`.
Reviews should use `docs/process/code_review.md`.
Do not claim merge readiness unless method gate, quality gate, and required checks pass.

<!-- CODEX_QUALITY_HARNESS_END -->
