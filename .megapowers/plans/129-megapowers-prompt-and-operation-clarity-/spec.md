## Goal

Replace the every-turn full-protocol prompt injection with a compact, phase-aware `## Megapowers` header in `extensions/megapowers/prompt-inject.ts`, and standardize the user-facing result/error strings returned by `handleSignal`, `handlePlanTask`, `handlePlanReview`, `handlePlanDraftDone`, and `handleCloseIssue` so each megapowers action consistently reports what changed, the artifact path when one was written, and the explicit next step. Existing workflow gates, TDD enforcement, phase prompt templates, plan-review semantics, focused-review fan-out, advisory subagent handling, and `/mega context` behavior remain unchanged.

## Acceptance Criteria

### Compact prompt — defaults

1. `buildInjectedPrompt(cwd, store)` returns a prompt that does **not** contain the literal heading `## Megapowers Protocol` when an active issue and phase are set.
2. `buildInjectedPrompt(cwd, store)` returns a prompt that contains the literal heading `## Megapowers` when an active issue and phase are set.
3. The compact header includes the active phase name, and when `state.phase === "plan"` and `state.planMode` is set, includes the plan mode label in the form `plan (draft)`, `plan (revise)`, or `plan (review)`.
4. The compact header includes the active issue slug.
5. The compact header includes the current task's `index` and `description` when `state.phase === "implement"` and `deriveTasks(cwd, slug)` returns a task at `state.currentTaskIndex`.
6. The compact header lists allowed megapowers actions for the current phase / plan mode, and no actions that belong only to other phases.
7. The compact header includes the rule `Do not edit .megapowers/state.json.` whenever it renders for an active issue.
8. The compact header includes guidance instructing the agent to follow Megapowers tool error messages and retry, in every active-issue render.

### Compact prompt — per phase / plan mode

9. When `state.phase === "plan"` and `state.planMode === "draft"`, the compact header lists `megapowers_plan_task` and `megapowers_signal({ action: "plan_draft_done" })` and warns against bypassing review with `phase_next`.
10. When `state.phase === "plan"` and `state.planMode === "revise"`, the compact header lists `megapowers_plan_task` and `megapowers_signal({ action: "plan_draft_done" })` and warns against bypassing review with `phase_next`.
11. When `state.phase === "plan"` and `state.planMode === "review"`, the compact header lists `megapowers_plan_review` with both `"approve"` and `"revise"` verdicts, warns against using deprecated `review_approve`, and warns against forcing `phase_next`.
12. When `state.phase === "implement"`, the compact header lists `tests_failed`, `tests_passed`, and `task_done` as allowed `megapowers_signal` actions.
13. When `state.phase === "verify"`, the compact header lists `phase_next` and `phase_back` as allowed `megapowers_signal` actions.
14. When `state.phase === "code-review"`, the compact header lists `phase_next` and `phase_back` as allowed `megapowers_signal` actions.
15. When `state.phase === "done"`, the compact header notes that push/PR and post-merge cleanup are allowed in this phase, and lists `megapowers_signal({ action: "close_issue" })` as the wrap-up action.
16. The compact header does **not** name deprecated `review_approve` as an allowed action in any phase.

### Compact prompt — assembly preservation

17. After the compact header, `buildInjectedPrompt` still appends the existing phase prompt template content (via `getPhasePromptTemplate(phase)` / `resolvePlanTemplate(planMode)` and `loadPromptFile`) for phases that have one — including `write-plan.md`, `review-plan.md`, `revise-plan.md`, `implement-task.md`, `verify.md`, `code-review.md`, `done.md`, and bugfix `reproduce-bug.md` / `diagnose-bug.md`.
18. After the compact header, `buildInjectedPrompt` still loads workflow phase artifacts into template variables (per `WorkflowConfig.phases[*].artifact` and `phaseAliases`).
19. After the compact header, `buildInjectedPrompt` still derives `acceptance_criteria_list`, current-task variables (`buildImplementTaskVars`), and brainstorm/plan `learnings` + `roadmap` variables for the phases that consume them.
20. After the compact header, `buildInjectedPrompt` still computes `done`-phase `branch_name`, `base_branch`, `files_changed`, `done_actions_list`, and `learnings` variables when applicable.
21. After the compact header, `buildInjectedPrompt` still injects `revise_instructions` for plan-revise mode and `focused_review_artifacts` for plan-review mode (when not an advisory subagent session).
22. After the compact header, `buildInjectedPrompt` still emits `buildAdvisoryPlanReviewSubagentSection()` for advisory plan-review subagent sessions and skips main plan-review prompt content in that case.
23. After the compact header, `buildInjectedPrompt` still appends `deriveToolInstructions(phaseConfig, slug, { isTerminal })` for the active phase, except where already suppressed for plan-review.
24. After the compact header, `buildInjectedPrompt` still appends `buildSourceIssuesContext(...)` when the active issue has linked source issues.
25. The compact header's listed allowed actions for each phase are sourced from a single internal allowed-action mapping (e.g. a table keyed by phase or `(phase, planMode)`) so that `deriveToolInstructions` and the compact header cannot drift; tests assert the two views agree for `implement`, `verify`, `code-review`, `done`, and each plan mode.

### Compact prompt — open issues / commands

26. When an active issue and phase are set, `buildInjectedPrompt` returns a prompt that does **not** include the heading `## Open Issues`.
27. When an active issue and phase are set, `buildInjectedPrompt` returns a prompt that does **not** include the heading `## Available Commands`.

### No-active-issue prompt

28. When `state.megaEnabled` is true and `state.activeIssue` is null, `buildInjectedPrompt(cwd, store)` returns a prompt containing the heading `## Megapowers` and a "No active issue." line.
29. The no-active-issue prompt lists `/issue list`, `/issue new`, and `/triage` as next-step actions.
30. The no-active-issue prompt includes the rule `Do not edit .megapowers/state.json.` and the tool-error guidance from AC8.
31. The no-active-issue prompt includes a compact open-issues list derived from `store.listIssues()` filtered to non-`done`, non-`archived` issues, in the same `- #NNN <title> (milestone: ..., priority: ...)` format the current `buildIdlePrompt` uses.
32. The no-active-issue prompt does **not** include the full canonical `## Megapowers Protocol` block.

### Full-protocol rendering path

33. A new exported function (e.g. `renderFullProtocolPrompt()`) in the prompt-inject module returns a string containing the literal heading `## Megapowers Protocol` sourced from `prompts/megapowers-protocol.md`.
34. `renderContextReport(cwd, store, { debug: true })` (already used by `/mega context debug`) continues to include the rendered prompt section, and a test asserts its output contains the compact `## Megapowers` header for active sessions.
35. `renderFullProtocolPrompt` is reachable from tests without going through `buildInjectedPrompt`.

### Signal feedback

36. `handleSignal` success messages for `task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `plan_draft_done`, and `close_issue` each begin with a status verb / icon (e.g. `✅`, `📋`, `⚠️`) from a shared vocabulary defined in code (e.g. a `feedback.ts` module under `extensions/megapowers/`).
37. `task_done` success message names the completed task (`index` + `description`), the count of remaining tasks, and either the next task identifier or the message that the phase will auto-advance to verify.
38. `phase_next` success message names the new phase and gives an explicit next-step phrase for that phase.
39. `phase_back` success message names the new phase and gives an explicit "rework needed" / next-step phrase.
40. `tests_failed` success message states that RED is recorded and that production writes are now allowed.
41. `tests_passed` success message states that GREEN is recorded.
42. `plan_draft_done` success message names the count of tasks saved and states the transition to review mode.
43. `close_issue` success message names the closed issue slug and, when sources were auto-closed, includes the count of source issues closed.

### Plan task feedback

44. `handlePlanTask` create-success message includes the task `id`, the task `title`, the saved artifact path under `.megapowers/plans/<slug>/tasks/task-NNN.md`, and an explicit list of the fields set.
45. `handlePlanTask` update-success message includes the task `id`, the task `title`, the saved artifact path, and an explicit list of which fields changed (or "no changes" when only the description was rewritten unchanged).
46. `handlePlanTask` error messages identify the action name (e.g. "plan_task") and name the corrective action (e.g. "provide title", "fix lint errors", "delete and recreate corrupt task").

### Plan review feedback

47. `handlePlanReview` revise-verdict success message includes the iteration number, the approved task IDs, the needs-revision task IDs, and the explicit next step (transition to revise mode + new review session).
48. `handlePlanReview` approve-verdict success message includes the iteration number, the count of approved tasks, the generated `plan.md` artifact path under `.megapowers/plans/<slug>/plan.md`, and the explicit next step (advancing to implement).
49. `handlePlanReview` error messages identify the action name (e.g. "plan_review") and name the corrective action (e.g. "submit during plan review", "write revise-instructions file before revise verdict").

### Shared vocabulary and artifact paths

50. A shared helper module exports the status icons / verbs and a helper that composes a result message with optional artifact path and next-step lines, and is used by `handleSignal`, `handlePlanTask`, `handlePlanReview`, `handlePlanDraftDone`, and `handleCloseIssue`.
51. Whenever a megapowers action writes or updates a file under `.megapowers/plans/<slug>/`, its success message includes the relative path of that file.
52. Existing `SignalResult` / `PlanTaskResult` / `PlanReviewResult` structured fields (`message`, `error`, `triggerNewSession`) keep their current names and semantics; only the contents of `message` / `error` strings change.

### Documentation

53. A short `docs/` page (e.g. `docs/operation-feedback.md`) documents the shared status vocabulary, the result-message shape (status / what changed / artifact path / next step), and how new megapowers tools should adopt it.

### Tests

54. `tests/prompt-inject.test.ts` covers, at minimum: compact-default for active issues (AC1, AC2, AC7, AC8); per-phase allowed-action presence (AC9–AC15); absence of deprecated `review_approve` from any compact header (AC16); preservation of phase template rendering (AC17); absence of `## Open Issues` / `## Available Commands` headings in active-issue prompts (AC26, AC27).
55. New or existing tests cover the no-active-issue prompt shape (AC28–AC32) using a mocked `Store`.
56. A test in `tests/prompt-inject.test.ts` (or a new file) asserts `renderFullProtocolPrompt()` contains `## Megapowers Protocol` (AC33, AC35).
57. `tests/context-summary.test.ts` (or `tests/commands-context.test.ts`) asserts `renderContextReport({ debug: true })` includes the compact `## Megapowers` header (AC34).
58. A test asserts the shared allowed-action mapping is consistent with `deriveToolInstructions` for `implement`, `verify`, `code-review`, `done`, `plan(draft)`, `plan(revise)`, and `plan(review)` (AC25).
59. `tests/tool-signal.test.ts` covers each `megapowers_signal` action's success message shape (AC36–AC43).
60. `tests/tool-plan-task.test.ts` covers create and update message shape, including artifact path and fields-changed list (AC44–AC46).
61. `tests/tool-plan-review.test.ts` covers approve and revise message shape, including iteration, approved/revise IDs, generated `plan.md` path, and error message wording (AC47–AC49).
62. Existing focused-review and advisory-subagent tests under plan-review continue to pass without modification beyond message-text updates implied by AC11 (AC22).
63. `bun test` passes after the work lands.

## Out of Scope

- Per-session "first activation" full-protocol reminder (D1).
- Surfacing the full protocol in the no-active-issue idle prompt by default (D2).
- Major TUI redesign for action feedback, including new status footer / widgets beyond what `/mega context` already provides (D3, also referenced in O2).
- Full telemetry, metrics, or progress bars for megapowers actions (D4).
- Rewriting tool messages that are already clear and consistent and not covered by AC36–AC52 (D5).
- Workflow redesign, weakening of gates, or changes to TDD enforcement (D6, partially covered by AC overall preservation requirements).
- Changes to issue activation, branching, WIP-commit, or close behavior (D7).
- Deeper UX rework of `/issue`, `/phase`, or `/mega on|off` slash commands beyond aligning their result wording with the new vocabulary; result-wording alignment for those commands is itself optional this slice (D8).
- A user-facing `/mega context full` or `/mega prompt full|compact` command (O1). The internal full-protocol renderer is required by AC33, but no new user-facing command is created in this slice.
- A "started" / progress hint shown before perceptibly slow megapowers operations (O2).
- A compact one-line `Commands:` list in the no-active-issue prompt beyond the explicit action list already required by AC29 (O4).

## Open Questions

None.

## Requirement Traceability

- R1 → AC 1, AC 32
- R2 → AC 2, AC 3, AC 4, AC 5
- R3 → AC 6, AC 9, AC 10, AC 11, AC 12, AC 13, AC 14, AC 15, AC 16
- R4 → AC 7, AC 30
- R5 → AC 8, AC 30
- R6 → AC 9, AC 10
- R7 → AC 9, AC 10
- R8 → AC 11
- R9 → AC 11, AC 16
- R10 → AC 5, AC 12
- R11 → AC 13
- R12 → AC 14
- R13 → AC 15
- R14 → AC 17
- R15 → AC 33, AC 34, AC 35
- R16 → AC 26
- R17 → AC 27
- R18 → AC 28, AC 29, AC 30, AC 31, AC 32
- R19 → AC 17, AC 18, AC 19, AC 20, AC 21, AC 22, AC 23, AC 24
- R20 → AC 21, AC 22
- R21 → AC 23, AC 25
- R22 → AC 36, AC 37, AC 40, AC 41, AC 42, AC 43
- R23 → AC 37, AC 38, AC 39, AC 42, AC 43
- R24 → AC 44, AC 45, AC 46, AC 51
- R25 → AC 47, AC 48, AC 49
- R26 → AC 44, AC 45, AC 48, AC 50, AC 51
- R27 → AC 46, AC 49
- R28 → AC 36, AC 50, AC 53
- R29 → AC 54, AC 55, AC 56, AC 57, AC 58
- R30 → AC 59, AC 60, AC 61
- R31 → AC 63

Optional / Deferred / Constraints:

- O1 → Out of Scope
- O2 → Out of Scope
- O3 → AC 53
- O4 → Out of Scope
- D1 → Out of Scope
- D2 → Out of Scope
- D3 → Out of Scope
- D4 → Out of Scope
- D5 → Out of Scope
- D6 → Out of Scope (and preserved by AC 17–AC 24)
- D7 → Out of Scope
- D8 → Out of Scope
- C1 → AC 52 (and AC 17–AC 24 do not introduce derived state writes)
- C2 → AC 25, AC 58
- C3 → AC 33
- C4 → AC 17–AC 24 (assembly preserved in `prompt-inject.ts`), AC 50 (shared feedback module under `extensions/megapowers/`), AC 25 (allowed-action mapping module)
- C5 → AC 25, AC 58
- C6 → AC 52
- C7 → AC 54–AC 62
- C8 → AC 34, AC 57
- C9 → AC 17, AC 23, AC 25
