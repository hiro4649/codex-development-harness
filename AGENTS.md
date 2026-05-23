# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v0.7.2
## Codex Quality Harness

縺吶∋縺ｦ縺ｮCodex菴懈･ｭ縺ｯ縲∵怙蟆丞ｷｮ蛻・∬ｨｼ諡繝吶・繧ｹ縲￣R蜑肴､懆ｨｼ繧貞ｿ・医→縺吶ｋ縲・

螳溯｣・燕縺ｫ縲∫岼逧・・撼逶ｮ逧・∝女縺大・繧梧擅莉ｶ縲√ユ繧ｹ繝郁ｨ育判縲∵ｮ九Μ繧ｹ繧ｯ繧堤洒縺冗｢ｺ隱阪☆繧九・

莉墓ｧ倥√ユ繧ｹ繝医∝ｮ溯｣・√Μ繝ｪ繝ｼ繧ｹ縺ｮ繝ｬ繝薙Η繝ｼ隕ｳ轤ｹ縺ｯ docs/process/skills 繧貞盾辣ｧ縺吶ｋ縲・

PR蜑阪↓ scripts/codex-local-quality-gate.sh 繧貞ｮ溯｡後☆繧九ょ､ｱ謨励∵悴螳溯｡後√せ繧ｭ繝・・縺ｯPR譛ｬ譁・↓譏手ｨ倥☆繧九・

secret縲｝rivate key縲》oken縲．B URL縲〉aw production log縲〉aw payload繧貞・蜉帙∽ｿ晏ｭ倥…ommit縺励↑縺・・

辟｡髢｢菫ゅ↑繝ｪ繝輔ぃ繧ｯ繧ｿ縲∽ｾ晏ｭ倩ｿｽ蜉縲∝多蜷肴紛逅・∝ｺ・ｯ・峇螟画峩繧呈ｷｷ縺懊↑縺・・

## Generic Project Rule

譁ｰ隕上・繝ｭ繧ｸ繧ｧ繧ｯ繝医〒縺ｯ縲∵怙蛻昴↓README縲｝ackage險ｭ螳壹√ユ繧ｹ繝医さ繝槭Φ繝峨，I繧ｲ繝ｼ繝医￣R繝・Φ繝励Ξ繝ｼ繝医ｒ謠・∴縺ｦ縺九ｉ讖溯・螳溯｣・↓蜈･繧九・

荳肴・縺ｪ隕∽ｻｶ縺ｯ蜍晄焔縺ｫ陬懷ｮ後○縺壹∽ｻｮ螳壹→縺励※PR譛ｬ譁・↓谿九☆縲・

繝励Ο繧ｸ繧ｧ繧ｯ繝亥崋譛峨・莉墓ｧ俶ｨｩ螽√∫ｦ∵ｭ｢莠矩・√ユ繧ｹ繝医さ繝槭Φ繝峨′縺ゅｋ蝣ｴ蜷医・縲、GENTS.md縺ｫ譏手ｨ倥＠縺ｦ縺九ｉCodex螳溯｣・↓蜈･繧九・

## HARNESS Authority

HARNESS repo縺ｧ縺ｯIRIS_SPEC_AUTHORITY.md繧定ｦ∵ｱゅ＠縺ｪ縺・・

蜈ｱ騾嗹orkflow docs謨ｴ蛯吶〒縺ｯ docs/codex/AUTHORITY_POLICY.md 繧堤｢ｺ隱阪☆繧九・

project蝗ｺ譛我ｻ墓ｧ倥ｒ螟画峩縺吶ｋ蝣ｴ蜷医□縺代√◎縺ｮproject蛻･authority繧堤｢ｺ隱阪☆繧九・

R3螟画峩縺ｯhuman review蠢・医・env.example螟画峩縺ｯ蟆ら畑蛻､譁ｭ縺ｨ縺吶ｋ縲・

螳御ｺ・ｱ蜻翫〒縺ｯ螟画峩繝輔ぃ繧､繝ｫ縲∵､懆ｨｼ邨先棡縲∵ｮ九Μ繧ｹ繧ｯ繧呈・險倥☆繧九・

## OpenAI Codex Method Rule

Use `docs/process/CODEX_TASK_BRIEF_TEMPLATE.md` for non-trivial tasks.
For complex, ambiguous, R3, security, migration, dependency, release, or multi-file work, plan before coding.
PRs must satisfy `docs/process/CODEX_OPENAI_CODEX_METHOD_POLICY.md`.
Reviews should use `docs/process/code_review.md`.
Do not claim merge readiness unless method gate, quality gate, and required checks pass.

## Structured Evidence and CI Replay Rule

Root harness version is v0.7.2. Profile templates remain v0.7.0 compatible unless a project propagation task explicitly says otherwise.
Do not bump `profiles/*` to v0.7.2 only to satisfy source validation.
Prefer `.codex/evidence-pack.json`, `.codex/manual-confirmation.json`, CI replay, and PR body lint results over prose-only evidence where available.
Do not claim production ready, release ready, merge ready, go/no-go, or equivalent production/shipping wording without checkable evidence.
Use safe summary only: no raw diff, raw logs, raw payload, endpoint value, secret value, private path, production data, or personal data.
Manual confirmation cannot override non-overridable failures such as secret scan failure, blocked paths, high-confidence secret findings, implementation/harness mixing, profile required check failure, OpenAI method gate failure, stale evidence, or unsafe output.
For R3, security, release, dependency, migration, or multi-file work, keep plan-first evidence, review evidence, residual risks, and rollback or stop condition visible.

<!-- CODEX_QUALITY_HARNESS_END -->
