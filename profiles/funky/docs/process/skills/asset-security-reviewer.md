<!-- CODEX_QUALITY_HARNESS_FILE v0.6.8 -->
# Skill: Funky Asset Security Reviewer

Use for assets, NFT, FanPoint, ticket, tier, wallet, sendToWallet, admin, contract, or staging env changes.

Check:

- Owner, signer, relayer, hot wallet, and admin roles are not confused.
- Authentication and authorization protect every asset-changing path.
- Idempotency and double-execution prevention exist.
- On-chain success requires chainId, contract address, txHash, receipt, and relevant event evidence.
- DB updates do not substitute for on-chain confirmation.
- Secrets, private keys, DB URLs, and production logs are not shown or committed.
- The PR does not claim production ready without staging and receipt evidence.
