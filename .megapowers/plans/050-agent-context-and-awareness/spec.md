# Spec: Agent Context & Awareness (#050)

## Goal

When no issue is active but megapowers is enabled, the agent currently has zero awareness of the extension — `buildInjectedPrompt()` returns null and the dashboard shows minimal hints. This change adds an idle-mode prompt injection (protocol summary, open issues, slash commands, roadmap reference) and enhances the idle dashboard widget, plus applies specific correctness fixes to five prompt templates that reference stale `/phase` slash commands instead of `megapowers_signal`.

## Acceptance Criteria

1. `buildInjectedPrompt()` returns non-null content when `state.megaEnabled` is true and `state.activeIssue` is null.
2. `buildInjectedPrompt()` returns null when `state.megaEnabled` is false, regardless of whether an active issue exists.
3. The idle-mode prompt content includes the base protocol section (loaded from `megapowers-protocol.md`).
4. The idle-mode prompt content includes a list of open issues showing each issue's id, title, milestone, and priority.
5. The idle-mode prompt content includes available slash commands with short descriptions (at minimum `/issue new`, `/issue list`, `/triage`, `/mega on|off`).
6. The idle-mode prompt content includes a reference to `ROADMAP.md` and `.megapowers/milestones.md`.
7. `renderDashboardLines` in idle mode (no active issue) includes hint lines for `/issue new`, `/issue list`, `/triage`, and `/mega on|off`.
8. `renderDashboardLines` in idle mode includes a line referencing `ROADMAP.md` and `.megapowers/milestones.md`.
9. `renderDashboardLines` with an active issue is unchanged (no regression).
10. `megapowers-protocol.md` lists `phase_back` as an available signal action with description covering backward transitions (verify→implement, code-review→implement, review→plan).
11. `megapowers-protocol.md` lists `learnings` as a valid artifact phase in the `megapowers_save_artifact` section.
12. `review-plan.md` section numbering is sequential — the duplicate "### 5." is corrected to "### 6.".
13. `review-plan.md` "After Review" section references `megapowers_signal({ action: "phase_back" })` for going back to plan.
14. `implement-task.md` "Execution Mode" section is tightened to reduce verbosity while retaining all information.
15. `verify.md` references `megapowers_signal({ action: "phase_back" })` instead of `/phase implement` or `/phase plan`.
16. `code-review.md` references `megapowers_signal({ action: "phase_back" })` instead of `/phase implement` or `/phase plan` in "needs-fixes" and "needs-rework" sections.

## Out of Scope

- Full prompt template overhaul (deferred to #062).
- Interactive UI components in the dashboard — hints are plain text lines only.
- Injecting full ROADMAP.md content into the idle prompt (reference only, not inline).
- Write-policy flexibility changes (#044 — already solved).
- TDD `[no-test]` annotation work (#047 — already solved).

## Open Questions

None.
