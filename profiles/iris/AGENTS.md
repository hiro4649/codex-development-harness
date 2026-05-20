\## 基本方針



最小変更で要求を満たす。

証拠なしに成功を主張しない。

無関係な変更をしない。



\## IRIS Root Guard



現在の作業フォルダ直下に AGENTS.md / IRIS\_SPEC\_AUTHORITY.md / src / package.json があることを前提とする。

不足する場合は作業を進めず、残リスクに記載する。



IRIS\_SPEC\_AUTHORITY.md は現在の作業フォルダ直下の ./IRIS\_SPEC\_AUTHORITY.md だけを参照する。

作業フォルダ外の同名ファイルは参照しない。



\## IRIS 仕様参照



最初に ./IRIS\_SPEC\_AUTHORITY.md を確認する。

IRIS\_SPEC\_AUTHORITY.md が見つからない場合は、作業を進めず残リスクに記載する。



仕様判断は IRIS\_SPEC\_AUTHORITY.md の優先順位に従う。

関係する Phase 仕様と cross-phase addendum だけを読む。

古い README、report、コメント、コード、テストを仕様根拠にしない。

コードとテストは現在実装の証拠であり、仕様意味の上書きには使わない。



仕様矛盾は勝手に解決せず、残リスクに記載する。

仕様書を増やして完了扱いしない。



\## IRIS 変更制限



IRIS 本体のみ。

明示指示がない限り、docs / report / 仕様書変更、導線変更、改名、移動、削除、広範囲リファクタ、未依頼の抽象化、依存追加は禁止。



Phase 責務、I/O 契約、Core / Adapter 境界を壊さない。

Phase00 canonical enum を増やさない。

Phase16以降の internal profile / domain label / operator setting を canonical enum として扱わない。

candidate / approved / commit / execution の境界を壊さない。

近接修正を優先する。

同型一般化は同一関数内の最小限のみ。



\## 作業方法



編集前に関連ファイルを確認し、変更範囲を最小化する。

必要な場合だけ最大3項目の短い task list を作る。

長い計画説明、途中報告、ツール出力説明は不要。

実装後は対象テスト、lint、typecheck のうち必要最小限を実行する。

失敗したチェックを隠さない。



\## 境界系変更時の検証



candidate / approved / commit / execution / Adapter handoff / persistence writer / Phase04 action ownership / canonical enum / internal profile / world\_command / game input / OBS command / Admin Panel public surface に触れる場合だけ、対象テストに加えて最小の境界テストを1本まで実行してよい。



該当しない場合は対象テストのみ実行する。

全体テスト、広範囲確認、無関係な検証は禁止する。

境界テストが必要だが特定できない場合は、勝手に全体テストを実行せず残リスクに記載する。



\## 出力抑制



作業工程の説明は禁止。

調査過程、推論過程、ツール出力の説明は禁止。

仕様矛盾、作業停止、検証不能、危険な境界変更がある場合だけ理由を短く書く。

最終報告は原則1行で、変更ファイル / 検証結果 / 残リスク のみ返す。

長文ログ貼付、raw diff本文貼付、巨大JSON貼付は禁止。

secret、endpoint値、API key、token、raw payload、raw command、raw memory、raw OBS event、raw frame、OCR text、raw voice sample、dataset path、internal model pathを出力しない。

検証結果は script名、component label、safe reason label、PASS/FAIL、exit code、変更ファイル一覧に要約する。

git diff は原則 stat / file list / safe summary に限定する。

必要な場合でも raw diff本文ではなく、対象ファイル名と安全な変更要約だけにする。



\## 最終報告



変更ファイル:

検証結果:

残リスク:

## IRIS 開発キューの扱い

IRIS開発キュー.txt は、現在の作業フォルダに存在する場合、またはユーザーから明示提供された場合のみ、実装キューとして参照する。

IRIS開発キュー.txt が存在しない場合でも、それだけで作業停止しない。

IRIS開発キュー.txt は仕様権威ではない。

K項目を実装する時も、先に ./IRIS_SPEC_AUTHORITY.md を読み、該当する Phase 仕様と cross-phase addendum に従う。

K項目が仕様と衝突する場合は、実装せず残リスクに記載する。

通常は対象Node検証を優先する。

ただし scripts/run-tests.js / CI / test harness / runner 出力制御に触る場合だけ、必要最小の full run-tests または分割 run-tests を実行してよい。

full run-tests FAIL を握りつぶさない。

secret / endpoint値 / API key / token / raw payload / raw command / raw memory / raw OBS event / raw frame / OCR text / raw voice sample / dataset path / internal model path / raw logs を出さない。

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
<!-- CODEX_QUALITY_HARNESS_FILE v0.6.8 -->
## Codex Quality Harness

Use the repo-local harness files in `docs/process/` and `scripts/codex-*`.
Run the secret scan and local quality gate before reporting merge readiness.
R3 or human-review-required changes need manual confirmation for the current head.
Manual confirmation cannot override secret scan failures, blocked paths, high-confidence secrets, implementation/harness mixing, or profile-required failures.

## IRIS Boundary Rule

Use only repo-local `IRIS_SPEC_AUTHORITY.md` as the IRIS source of truth.
Preserve Phase ownership, Phase I/O, Core / Adapter boundary, and candidate / approved / commit / execution separation.
Boundary or adapter-affecting changes are R3 and require `docs/process/skills/iris-boundary-reviewer.md`.
<!-- CODEX_QUALITY_HARNESS_END -->
