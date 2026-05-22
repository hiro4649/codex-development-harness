<!-- CODEX_QUALITY_HARNESS_FILE v0.6.9 -->
# Skill: Funky Asset Security Reviewer

## title
Funky Asset Security Reviewer

## purpose
Protect asset, NFT, FanPoint, ticket, tier, wallet, admin, contract, and staging-env changes from unsafe readiness claims.

## whenToUse
Use for assets, NFT, FanPoint, ticket, tier, wallet, sendToWallet, admin, contract, or staging env changes.

## procedure

- Owner, signer, relayer, hot wallet, and admin roles are not confused.
- Authentication and authorization protect every asset-changing path.
- Idempotency and double-execution prevention exist.
- On-chain success requires chainId, contract address, txHash, receipt, and relevant event evidence.

## pitfalls

- DB updates do not substitute for on-chain confirmation.
- Secrets, private keys, DB URLs, and production logs are not shown or committed.
- The PR does not claim production ready without staging and receipt evidence.

## verification
Require safe summary evidence for authorization, ownership, on-chain receipt, event log, idempotency, rollback, and staging state.

## safeOutput
Return only safe summaries, file names, check names, PASS/FAIL, and residual risks. Do not output secrets, endpoint values, raw payloads, production logs, or private paths.
