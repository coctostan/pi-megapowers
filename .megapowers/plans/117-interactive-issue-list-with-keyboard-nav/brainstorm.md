## Goal
Replace the current `/issue list` dropdown with an interactive keyboard-driven issue list widget that makes the backlog faster to navigate and manage in-place. The outcome should preserve the existing ability to activate or create issues while adding richer issue actions, clearer visual state, and an in-widget detail view without leaving the issue-list flow.

## Mode
Direct requirements

The issue already specifies the target interaction model (`ctx.ui.custom()`), key behaviors (keyboard navigation, action menu, detail view, escape to dismiss), and likely integration points. The remaining work was clarification, not ideation, and those ambiguities have now been resolved.

## Must-Have Requirements
1. **R1.** `/issue list` must use a custom interactive widget instead of the current `ctx.ui.select()` picker.
2. **R2.** The widget must display active issues grouped by milestone, consistent with the current grouped issue list behavior.
3. **R3.** The widget must support keyboard navigation through issues using arrow keys.
4. **R4.** The widget must support keyboard navigation using Tab in addition to arrow keys.
5. **R5.** The widget must render milestone headers visibly in the list.
6. **R6.** Milestone header rows must not be focusable; keyboard navigation must skip directly between actionable rows.
7. **R7.** The widget must preserve a `+ Create new issue...` row at the bottom of the list.
8. **R8.** Selecting the `+ Create new issue...` row must enter the existing issue-creation flow.
9. **R9.** Pressing Enter on an issue row must open a contextual action menu for that issue.
10. **R10.** The per-issue action menu must include an **Open/Activate** action.
11. **R11.** The per-issue action menu must include an **Archive** action.
12. **R12.** The per-issue action menu must include a **View** action.
13. **R13.** The per-issue action menu for a non-active issue must include a **Close** action.
14. **R14.** The per-issue action menu for the active issue must offer both **Close now** and **Go to done phase** actions.
15. **R15.** Choosing **Open/Activate** must activate the selected issue with the same workflow activation behavior the current `/issue list` flow uses.
16. **R16.** Choosing **Archive** must archive the selected issue using the project’s existing archive behavior rather than introducing a separate archive mechanism.
17. **R17.** Choosing **View** must open a detail screen inside the same custom widget flow rather than launching a separate popup or leaving the issue-list experience.
18. **R18.** The detail screen must temporarily replace the issue list and provide a way to return to the list.
19. **R19.** The detail screen must show the full available issue contents rather than only a short summary.
20. **R20.** The issue list UI must show a clear cursor/highlight for the currently focused row.
21. **R21.** The issue list UI must show issue status badges or equivalent visual status indicators.
22. **R22.** The issue list UI must show which issue is currently active.
23. **R23.** Pressing Escape from the issue list must dismiss it without taking action.
24. **R24.** The interactive issue list must extend the existing issue-list behavior rather than regressing current sorting, grouping, activation, archive, and create-new functionality.

## Optional / Nice-to-Have
1. **O1.** The UI may reuse the same interaction feel and implementation pattern as `ui-checklist.ts` where that speeds delivery and keeps behavior consistent.
2. **O2.** The action menu may tailor available actions based on context as long as the required actions remain discoverable.
3. **O3.** The detail screen may show richer formatting for issue content if it can do so without increasing scope materially.

## Explicitly Deferred
1. **D1.** Broad issue-list visual polish beyond the requested cursor highlight, status indicators, and active-issue marker is deferred.
2. **D2.** New issue-management actions beyond **Open/Activate**, **Close**, **Close now**, **Go to done phase**, **Archive**, and **View** are deferred.
3. **D3.** Reworking archived-issue browsing is deferred; existing `/issue archived` behavior can remain separate unless needed for implementation reuse.
4. **D4.** Changing underlying issue storage, frontmatter format, or backlog architecture is deferred.
5. **D5.** Header-level actions such as collapsing milestone groups are deferred.

## Constraints
1. **C1.** The implementation should build on existing issue-list logic in `extensions/megapowers/ui.ts` rather than replace unrelated issue workflow behavior.
2. **C2.** The widget should use `ctx.ui.custom()` and follow the established custom-widget pattern already demonstrated by `extensions/megapowers/ui-checklist.ts`.
3. **C3.** Existing issue sorting/grouping semantics should remain intact unless the spec phase identifies a necessary exception.
4. **C4.** Existing activation side effects must continue to work when an issue is opened from the new widget, including normal state/VCS activation flow handled after `handleIssueCommand`.
5. **C5.** Existing archive behavior in the store should be reused rather than duplicated.
6. **C6.** The implementation should be testable with pure helper coverage where possible plus focused UI interaction tests.
7. **C7.** The design should avoid brittle menu loops or unmatched action labels that could hang tests or interactive flows.
8. **C8.** The detail-view approach should stay YAGNI-friendly: a simple in-widget replacement screen is preferred over split-pane or popup complexity.

## Open Questions
None.

## Recommended Direction
The cleanest path is to extract a dedicated `extensions/megapowers/ui-issue-list.ts` module that mirrors the custom-widget shape used by `ui-checklist.ts`, while keeping issue activation/archive/state mutation logic centralized in existing UI/store helpers. That keeps rendering and keyboard handling isolated from higher-level command flow, which is especially important for a UI-heavy feature with multiple actions and view states.

The issue list should be modeled as a flat sequence of renderable rows: milestone headers, issue rows, and the final `+ Create new issue...` row. Milestone headers should render visually but be skipped by the cursor so keyboard navigation lands only on actionable entries. Pressing Enter on an issue row should move into an action-menu state inside the same custom widget, rather than opening a separate selector.

The detail view should be a simple replacement screen inside the widget. That satisfies the “inline” requirement without introducing popup behavior or split-pane complexity. The view should show the full issue contents available to the widget and provide a clear return path back to the issue list. This keeps scope contained while still delivering a significantly richer issue browsing experience.

For close behavior, the widget should distinguish active vs non-active issues. Non-active issues can expose a straightforward close action. The active issue should expose both **Close now** and **Go to done phase**, since the user explicitly wants both available. The spec phase should define the exact semantics of “Close now” carefully so the implementation does not accidentally bypass important workflow expectations without intent.

## Testing Implications
- Add pure tests for row construction and ordering so grouped milestone layout, skipped header focus, and preserved create row are deterministic.
- Add focused interaction tests for keyboard navigation across issue rows and the create row.
- Verify milestone headers render but are not focusable.
- Verify Enter on an issue opens the action menu for that issue.
- Verify the action menu exposes the correct actions for active vs non-active issues.
- Verify Escape dismisses the widget without mutating state.
- Verify Open/Activate preserves existing activation behavior.
- Verify Archive uses existing archive behavior and updates rendered state correctly.
- Verify View opens an in-widget detail screen, shows full issue contents, and returns to the list correctly.
- Verify non-active issues can be closed through the action menu.
- Verify active issues expose both **Close now** and **Go to done phase**.
- Verify no regression in existing sorting, grouping, archive, activation, and create-new behavior.
