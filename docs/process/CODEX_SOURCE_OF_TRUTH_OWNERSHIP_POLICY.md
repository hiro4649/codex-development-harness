<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Source Of Truth Ownership Policy

Each changed responsibility has one owner module, owner file or package, public contract, downstream consumer list, and forbidden duplicate owner list.

The gate fails when duplicate active owners exist, a test fixture is treated as the owner, docs are treated as the only owner without implementation alignment, or controller/service/repository/adapter boundaries are mixed.
