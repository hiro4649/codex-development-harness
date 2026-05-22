## 基本方針

このプロジェクトは IRIS 本体ではなく、Live2D renderer 専用の sibling project として扱う。

IRIS 本体の src / docs / report / 仕様書 / IRIS_SPEC_AUTHORITY.md は変更しない。

最小変更で要求を満たし、無関係な変更をしない。

Git commit はしない。

## Renderer Readiness 境界

renderer_ready=true は、実 Cubism SDK load、model3 load、model_id / scene_id 一致、cue capability 確認、fresh browser heartbeat、last cue applied 成功がすべて揃った場合のみ候補にする。

SDK missing、model missing、heartbeat stale、mock health、cue-only では renderer_ready=false を維持する。

mock health、fixture、cue-only、local bridge を real renderer ready 扱いしない。

## Safe Output

raw cue payload、secret、endpoint 値、raw model path を public / ordinary output へ出さない。

GET /health、GET /status、POST /live2d-engine、POST /cue は safe summary のみ返す。

## 検証

対象 Node 検証のみ実行する。

失敗した検証を隠さない。

## 最終報告

最終報告は原則 1 行で、変更ファイル / 検証結果 / 残リスク のみ返す。

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
<!-- CODEX_QUALITY_HARNESS_FILE v0.6.9 -->
## Codex Quality Harness

Use the repo-local harness files in `docs/process/` and `scripts/codex-*`.
Run the secret scan and local quality gate before reporting merge readiness.
R3 or human-review-required changes need manual confirmation for the current head.
Manual confirmation cannot override secret scan failures, blocked paths, high-confidence secrets, implementation/harness mixing, or profile-required failures.

## IRIS Live2D Renderer Readiness Rule

このリポジトリはIRIS本体ではなく、Live2D renderer専用のsibling projectとして扱う。
IRIS本体用のIRIS_SPEC_AUTHORITY.mdは要求しない。このrepo直下のAGENTS.mdとrenderer readiness rulesを優先する。
renderer_ready=true は、実Cubism SDK load、model3 load、model_id / scene_id一致、cue capability確認、fresh browser heartbeat、last cue applied成功がすべて揃った場合のみ候補にする。
mock health、fixture、cue-only、local bridgeをreal renderer ready扱いしない。
raw cue payload、endpoint値、raw model path、secretをpublic outputへ出さない。
<!-- CODEX_QUALITY_HARNESS_END -->
