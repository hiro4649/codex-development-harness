---
name: deep-module-design
description: Read-only module design comparison focused on interface depth, seams, locality, migration cost, and independent review.
---

# Deep Module Design

Use for `architecture` tasks or when a confirmed finding shows missing test seams.

Steps:
1. Identify the module, interface, current seam, and real variation.
2. Produce up to two read-only design alternatives under different constraints.
3. Compare interface surface, hidden complexity, deletion test, test surface, locality, compatibility, and migration cost.
4. Choose the smaller change only when it preserves future leverage.
5. Emit structured JSON, not an HTML report.

Completion criteria:
- Designers are read-only and do not write code.
- Independent architecture reviewer compares alternatives.
- CDN, deploy, wallet, RPC, secret, and approval authority are forbidden.
- The result is a design recommendation, not merge authority.
