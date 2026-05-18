## Goal

Make Megapowers interactions clearer and less noisy in real use by combining two complementary improvements: (1) replace the every-turn full-protocol prompt injection with a compact, phase-aware header that names only the actions and rules relevant right now, and (2) standardize the user-facing feedback from `megapowers_signal`, `megapowers_plan_task`, and `megapowers_plan_review` so every action consistently tells the user what changed, where artifacts live, and what to do next.

## Mode

`Direct requirements`

Both source issues (#121, #128) already define concrete desired behavior with explicit acceptance criteria. The brainstorm's job is to consolidate them into one trustworthy list of requirements without losing anything, not to re-discover the problem.

## Must-Have Requirements

### Compact phase-aware prompt injection (from #128)

R1. The default injected prompt for an active issue does not include the full canonical `## Megapowers Protocol` block.

R2. The default injected prompt for an active issue includes a compact `## Megapowers` header that names the current phase (or plan mode), the current issue, and — when applicable — the current task.

R3. The compact header lists only the megapowers actions allowed in the current phase / plan mode.

R4. The compact header always includes the rule `Do not edit .megapowers/state.json.`

R5. The compact header always includes guidance to follow Megapowers tool error messages and retry rather than working around them.

R6. The plan-draft and plan-revise compact headers name `megapowers_plan_task` and `megapowers_signal({ action: "plan_draft_done" })` as allowed actions.

R7. The plan-draft and plan-revise compact headers warn against bypassing review via `phase_next`.

R8. The plan-review compact header names `megapowers_plan_review` (approve and revise) as the allowed action.

R9. The plan-review compact header warns against using deprecated `review_approve` and against forcing `phase_next`.

R10. The implement compact header names `tests_failed`, `tests_passed`, and `task_done` as allowed actions and includes the current task identifier when one is known.

R11. The verify compact header names `phase_next` and `phase_back` as allowed actions.

R12. The code-review compact header names `phase_next` and `phase_back` as allowed actions.

R13. The done compact header notes that push/PR and post-merge cleanup are allowed in this phase and names `close_issue` as the wrap-up action.

R14. Existing phase prompt templates (`write-plan.md`, `review-plan.md`, `revise-plan.md`, `implement-task.md`, `verify.md`, `code-review.md`, `done.md`, and bugfix equivalents) still render after the compact header.

R15. The full canonical `prompts/megapowers-protocol.md` content remains renderable through an explicit code path (callable by tests; surfaced via `/mega context full` or equivalent debug command).

R16. The full open-issues section is not injected on every turn while an issue is active.

R17. The full `## Available Commands` section is not injected on every turn while an issue is active.

R18. When no issue is active, the injected prompt uses a compact no-active-issue form that includes short issue-selection guidance and a compact open-issues list.

R19. Existing workflow gates, state transitions, TDD enforcement, and plan-review semantics are unchanged by this work.

R20. Existing focused-review advisory-artifacts handling and advisory-subagent anti-recursion section continue to work in plan-review.

R21. Existing derived tool instructions (`deriveToolInstructions`) and the compact header do not produce duplicated or conflicting allowed-action guidance.

### Operation feedback (from #121)

R22. Result messages for `megapowers_signal` actions (`task_done`, `tests_failed`, `tests_passed`, `phase_next`, `phase_back`, `plan_draft_done`, `close_issue`) consistently state what changed.

R23. Result messages for `megapowers_signal` state-advancing actions consistently state the explicit next step the user/agent should take.

R24. Result messages for `megapowers_plan_task` state which fields changed, include the artifact path of the saved task file, and remain self-consistent on both create and update paths.

R25. Result messages for `megapowers_plan_review` state the verdict, the iteration, which tasks were approved vs need revision, and the next step.

R26. When a megapowers action writes or updates an artifact, the result message includes the artifact's relative path under `.megapowers/plans/<issue-slug>/`.

R27. Error messages from `megapowers_signal`, `megapowers_plan_task`, and `megapowers_plan_review` consistently identify the action that failed and what the user needs to fix.

R28. Success and error messages across the three megapowers tools follow a consistent vocabulary (e.g. shared success / error / next-step phrasing conventions documented somewhere in code or `docs/`).

### Tests & integration

R29. Tests cover compact-vs-full prompt behavior, including: compact is default for active issues; full protocol is renderable via the explicit path; phase-specific allowed actions appear in the right headers; safety rules (`state.json`, error handling) remain visible in compact mode.

R30. Tests cover representative operation-feedback messages for each of `megapowers_signal` (each action), `megapowers_plan_task` (create + update), and `megapowers_plan_review` (approve + revise).

R31. `bun test` passes after the work lands.

## Optional / Nice-to-Have

O1. A user-facing `/mega context full` (or `/mega prompt full|compact`) command that renders the canonical full protocol on demand, beyond the existing `/mega context debug` debug surface.

O2. A "started" / progress hint for slash commands and tools that take perceptible time (e.g. focused-review fan-out, plan approval generating `plan.md`).

O3. A small `docs/` page documenting the standardized success/error/next-step wording conventions used across megapowers tools.

O4. A compact `Commands:` one-liner included when no issue is active, listing the most useful slash commands.

## Explicitly Deferred

D1. Per-session "first activation" reminder that re-surfaces the full protocol on session boundaries.

D2. Surfacing the full protocol in the no-active-issue idle prompt by default.

D3. Major TUI redesign for action feedback (status footer / widgets beyond what `/mega context` already does).

D4. Full telemetry, metrics, or progress bars for megapowers actions.

D5. Rewriting tool messages that are already clear and consistent.

D6. Redesigning the workflow, weakening gates, or changing TDD enforcement.

D7. Changing issue activation, branching, WIP-commit, or close behavior.

D8. Reworking slash commands like `/issue` and `/phase` beyond aligning their result wording with the new vocabulary; deeper UX work for them stays out of scope.

## Constraints

C1. `.megapowers/state.json` remains coordination state only; nothing in this work persists derived prompt or context data into it.

C2. The compact header and the derived tool instructions must not contradict each other on which actions are allowed in a given phase.

C3. The full canonical protocol content lives in `prompts/megapowers-protocol.md` and must remain the source of truth for the explicit/full rendering path.

C4. Implementation fits the existing structure: `extensions/megapowers/prompt-inject.ts` for assembly, `extensions/megapowers/context-summary.ts` for inspection helpers, `extensions/megapowers/tools/tool-*.ts` for action result wording.

C5. Compact header content is generated from canonical workflow config / phase metadata where practical, not hand-duplicated per phase, to avoid drift between the header, `deriveToolInstructions`, and the workflow registry.

C6. Operation-feedback changes preserve any existing structured fields tests rely on (`triggerNewSession`, etc.); only message text and consistency are tightened.

C7. All changes are testable without a live Pi TUI (unit / hook-mock level).

C8. Issue #120 work (`/mega context`, `/mp context`, status indicator) is already shipped; this issue must not regress it.

C9. Issue #127 work (phase-specific tool guidance in injected prompts) must not regress; the compact header references or coexists with that guidance rather than replacing it with a parallel system.

## Open Questions

None.

## Recommended Direction

Split implementation into two coherent slices that ship together in one issue:

**Slice A — Compact phase-aware prompt.** Refactor `buildInjectedPrompt` in `extensions/megapowers/prompt-inject.ts`. Replace the unconditional `loadPromptFile("megapowers-protocol.md")` push with a small renderer that builds the compact `## Megapowers` header from the canonical workflow config plus a tiny per-phase metadata table (allowed actions, critical rules). Drive `deriveToolInstructions` from the same source so the two cannot drift. Keep `renderFullProtocolPrompt` as an exported helper for the existing `/mega context debug` path and for an optional `/mega context full`. Rework `buildIdlePrompt` to a compact no-active-issue form with short issue-selection guidance, a compact open-issues list, and a one-line `Commands:` hint. All existing artifact loading, acceptance-criteria derivation, current-task variables, focused-review artifact handling, and advisory-subagent anti-recursion logic continues unchanged.

**Slice B — Standardized operation feedback.** Audit the message strings returned by `handleSignal`, `handlePlanDraftDone`, `handlePlanTask`, `handlePlanReview`, `handleCloseIssue`, and friends. Tighten them around a shared shape: a leading status verb (`✅ saved` / `📋 advanced` / `⚠️ revise` / `❌ failed`), a "what changed" line, an artifact path when applicable, and an explicit "next step" line. The current `tool-signal.ts` and `tool-plan-task.ts` already use parts of this pattern; the work is to make it consistent, include artifact paths everywhere a file is written, and ensure errors say which action failed and what to fix. Document the convention briefly in `docs/` so future tool authors stay aligned.

Both slices are touched by the same review/test pass and share testing infrastructure (`tests/prompt-inject.test.ts`, `tests/tool-signal.test.ts`, `tests/tool-plan-task.test.ts`, `tests/tool-plan-review.test.ts`, possibly a new `tests/operation-feedback.test.ts` for the cross-cutting vocabulary check). The compact header *is* the prompt-side analog of the operation-feedback work; doing them together keeps the user-facing and agent-facing vocabulary consistent.

## Testing Implications

- Compact prompt is the default for any active-issue path; the resulting prompt does **not** contain the literal `## Megapowers Protocol` heading.
- Compact prompt contains `## Megapowers` header, the current phase / plan-mode label, and only the phase-relevant action names.
- Compact prompt contains `Do not edit .megapowers/state.json.` and tool-error guidance in every active-issue phase.
- Full protocol rendering helper still produces the canonical `## Megapowers Protocol` content (covers idle/debug surfaces).
- No-active-issue prompt contains issue-selection guidance and a compact open-issues list.
- Per-phase tests assert the right set of allowed actions appears in the compact header for `plan(draft)`, `plan(revise)`, `plan(review)`, `implement`, `verify`, `code-review`, and `done`.
- Compact header does not list deprecated `review_approve`; plan-review header explicitly warns against it.
- `deriveToolInstructions` output does not duplicate or contradict compact-header allowed actions.
- `megapowers_signal` action result messages mention what changed and an explicit next step for `task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `plan_draft_done`, `close_issue`.
- `megapowers_plan_task` result messages include the saved task file path on both create and update; describe which fields changed.
- `megapowers_plan_review` result messages reflect verdict, iteration, approved-vs-revise task IDs, and next step.
- Error messages from each megapowers tool name the failing action and the corrective action.
- `/mega context` and `/mega context debug` output (existing #120 surface) does not regress; tests pinning that behavior still pass.
- Focused-review advisory artifacts and advisory-subagent anti-recursion path still work in plan-review.
- `bun test` passes.
