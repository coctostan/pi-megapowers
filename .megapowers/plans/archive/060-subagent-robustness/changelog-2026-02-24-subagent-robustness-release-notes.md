## 2026-02-24 — Subagent Robustness: Guided jj setup + stronger builtin agents

- Megapowers now checks jj readiness at session start and shows clear, non-blocking guidance when setup is missing (including `brew install jj`, `cargo install jj-cli`, and `jj git init --colocate`).
- Subagent dispatch errors now include actionable install/setup steps instead of a vague repo-only failure message, making recovery much faster.
- Builtin `worker`, `scout`, and `reviewer` agents now have richer role-specific instructions and distinct model/thinking profiles for better task execution, research quality, and review quality.
- Subagents now receive current workflow phase and spec/diagnosis acceptance-criteria context, improving behavior during implement and verify workflows.
- **Breaking changes:** None.
