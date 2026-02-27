## 2026-02-26 — Agent context & awareness in idle mode (#050)

- **Idle-mode prompt injection**: when no issue is active and megapowers is enabled, the agent now receives the full protocol summary, a list of open issues (with milestone and priority), available slash commands, and a reference to `ROADMAP.md` / `.megapowers/milestones.md` — it is no longer silently unaware of the extension.
- **Idle dashboard hints**: the sidebar widget now shows `/triage`, `/mega on|off`, and a roadmap reference line when no issue is active, alongside the existing `/issue new` and `/issue list` hints.
- **`phase_back` signal**: `megapowers_signal({ action: "phase_back" })` is now a real, callable action — it navigates backward through the workflow (review→plan, verify→implement, code-review→implement) without needing manual state edits.
- **Issue model gains `milestone` and `priority` fields**: parsed from frontmatter; existing issues default to `milestone: ""` and `priority: 0` with no migration required.
- **Prompt template corrections**: stale `/phase implement` and `/phase plan` slash commands replaced with `megapowers_signal({ action: "phase_back" })` in `verify.md`, `code-review.md`, and `review-plan.md`; duplicate `### 5.` section heading in `review-plan.md` fixed to `### 6.`; `learnings` added to the valid artifact phases list in `megapowers-protocol.md`.
