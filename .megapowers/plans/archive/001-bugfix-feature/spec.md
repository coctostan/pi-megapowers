# Spec: Bugfix Mode (Component 03)

## Goal

Wire up the bugfix workflow (`reproduce → diagnose → plan → review → implement → verify → done`) so that creating a bugfix issue provides a fully guided experience — with phase gates, artifact routing, prompt injection, and a bugfix-specific done-phase menu — matching the level of support feature mode already has.

## Acceptance Criteria

1. When a bugfix issue enters the `reproduce` phase, the LLM receives the `reproduce-bug.md` prompt template with `{{issue_slug}}` interpolated.
2. When the LLM produces output during the `reproduce` phase with length > 100 chars, it is saved as `reproduce.md` in `.megapowers/plans/{issue}/`.
3. The gate from `reproduce → diagnose` fails with a descriptive message when `reproduce.md` does not exist.
4. The gate from `reproduce → diagnose` passes when `reproduce.md` exists.
5. When a bugfix issue enters the `diagnose` phase, the LLM receives the `diagnose-bug.md` prompt template with `{{issue_slug}}` and `{{reproduce_content}}` (loaded from `reproduce.md`) interpolated.
6. When the LLM produces output during the `diagnose` phase with length > 100 chars, it is saved as `diagnosis.md` in `.megapowers/plans/{issue}/`.
7. The gate from `diagnose → plan` fails with a descriptive message when `diagnosis.md` does not exist.
8. The gate from `diagnose → plan` passes when `diagnosis.md` exists.
9. If `diagnosis.md` contains a `## Fixed When` section with numbered criteria, they are extracted into `state.acceptanceCriteria` with status `pending`.
10. If `diagnosis.md` has no `## Fixed When` section, `state.acceptanceCriteria` remains empty (no error).
11. When a bugfix issue enters the `plan` phase, the prompt template receives `{{reproduce_content}}` and `{{diagnosis_content}}` as template variables (instead of feature's `{{brainstorm_content}}` and `{{spec_content}}`).
12. When a bugfix issue reaches the `done` phase, the menu shows "Generate bugfix summary", "Write changelog entry", "Capture learnings", "Close issue" (not "Generate feature doc").
13. Selecting "Generate bugfix summary" sets `doneMode` to `"generate-bugfix-summary"` and notifies the user that bugfix summary mode is active.
14. The `generate-bugfix-summary.md` prompt template receives `{{reproduce_content}}`, `{{diagnosis_content}}`, `{{plan_content}}`, `{{files_changed}}`, and `{{learnings}}` as variables.
15. The `doneMode` type in `MegapowersState` includes `"generate-bugfix-summary"` as a valid value.
16. The `PHASE_PROMPT_MAP` maps `reproduce` to `reproduce-bug.md` (not `diagnose-bug.md`).
17. Every option in the bugfix done-phase menu either matches a handled branch or hits a catch-all that exits the loop.

## Out of Scope

- Regression test enforcement beyond what the existing TDD guard already provides during `implement`
- Bugfix-specific `code-review` phase (bugfix workflow goes `verify → done`, no code-review)
- Automatic detection of whether a bug is "big enough" for AC tracking
- Changes to the state machine transition graph (already correct)
- Changes to shared phases (plan, review, implement, verify) beyond prompt variable injection

## Open Questions

