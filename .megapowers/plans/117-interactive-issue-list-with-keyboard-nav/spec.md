## Goal
Build a custom interactive `/issue list` widget using `ctx.ui.custom()` that preserves the current grouped issue-list workflow while making issue navigation and management faster through keyboard-driven list navigation, in-widget issue actions, and an inline detail view.

## Acceptance Criteria
1. Running `/issue list` opens a custom interactive widget instead of the current `ctx.ui.select()` picker.
2. The widget renders issues grouped by milestone using the same grouping and ordering semantics the current issue-list flow uses.
3. The widget renders each milestone header visibly above its group of issues.
4. Milestone header rows are not focusable and keyboard navigation skips them.
5. The widget renders a `+ Create new issue...` row as the final actionable row after all milestone groups.
6. Pressing Up or Down moves focus between actionable rows in the issue list, including the create row.
7. Pressing Tab moves focus forward between actionable rows in the issue list, including the create row.
8. The currently focused actionable row is shown with a clear visual cursor or highlight.
9. Each issue row shows a visual status indicator or badge representing the issue’s status.
10. The currently active issue is visibly marked in the list.
11. Pressing Escape while on the issue list dismisses the widget without activating, creating, archiving, closing, or otherwise mutating any issue.
12. Pressing Enter on the `+ Create new issue...` row starts the existing issue-creation flow used by `/issue list` today.
13. Pressing Enter on an issue row opens an in-widget action menu for that specific issue.
14. The action menu for any issue includes `Open/Activate`, `Archive`, and `View`.
15. The action menu for a non-active issue includes `Close`.
16. The action menu for the active issue includes both `Close now` and `Go to done phase`.
17. Choosing `Open/Activate` activates the selected issue using the same activation behavior and downstream side effects as the current `/issue list` flow.
18. Choosing `Archive` archives the selected issue by reusing the project’s existing archive behavior.
19. Choosing `View` replaces the list with an in-widget detail screen for the selected issue rather than opening a separate popup or leaving the issue-list flow.
20. The detail screen shows the full issue contents available from the existing issue data for the selected issue.
21. The detail screen provides a return action that restores the prior issue-list view.
22. Choosing `Close` on a non-active issue closes that issue using existing issue-closing behavior.
23. Choosing `Close now` on the active issue performs the existing immediate-close behavior for the active issue.
24. Choosing `Go to done phase` on the active issue performs the existing action for moving the active issue to the done phase.
25. The implementation does not regress existing `/issue list` behavior for sorting, grouping, activation, archiving, or create-new flow.
26. The issue-list row-building and navigation behavior is covered by deterministic pure tests, including grouping, row ordering, non-focusable milestone headers, and preservation of the create row.
27. Focused interaction tests cover keyboard navigation, Enter-to-open action menu, Escape-to-dismiss, action availability for active vs non-active issues, and the in-widget detail-view flow.

## Out of Scope
- Additional issue-management actions beyond `Open/Activate`, `Close`, `Close now`, `Go to done phase`, `Archive`, and `View`.
- Archived-issue browsing changes outside the existing `/issue archived` behavior.
- Changes to issue storage, issue frontmatter, or backlog architecture.
- Header-level milestone actions such as collapsing or expanding groups.
- Broad visual polish beyond focused-row highlighting, status indicators, and active-issue marking.
- Rich detail-screen formatting beyond showing full available issue contents inside the widget.
- Any redesign of unrelated issue workflow behavior outside the `/issue list` experience.

## Open Questions
None.

## Requirement Traceability
- `R1 -> AC 1`
- `R2 -> AC 2`
- `R3 -> AC 6`
- `R4 -> AC 7`
- `R5 -> AC 3`
- `R6 -> AC 4`
- `R7 -> AC 5`
- `R8 -> AC 12`
- `R9 -> AC 13`
- `R10 -> AC 14`
- `R11 -> AC 14, AC 18`
- `R12 -> AC 14, AC 19, AC 20, AC 21`
- `R13 -> AC 15, AC 22`
- `R14 -> AC 16, AC 23, AC 24`
- `R15 -> AC 17`
- `R16 -> AC 18`
- `R17 -> AC 19`
- `R18 -> AC 19, AC 21`
- `R19 -> AC 20`
- `R20 -> AC 8`
- `R21 -> AC 9`
- `R22 -> AC 10`
- `R23 -> AC 11`
- `R24 -> AC 2, AC 12, AC 17, AC 18, AC 25`

- `O1 -> Out of Scope`
- `O2 -> Out of Scope`
- `O3 -> Out of Scope`

- `D1 -> Out of Scope`
- `D2 -> Out of Scope`
- `D3 -> Out of Scope`
- `D4 -> Out of Scope`
- `D5 -> Out of Scope`

- `C1 -> AC 17, AC 18, AC 22, AC 23, AC 24, AC 25`
- `C2 -> AC 1`
- `C3 -> AC 2, AC 25`
- `C4 -> AC 17`
- `C5 -> AC 18`
- `C6 -> AC 26, AC 27`
- `C7 -> AC 13, AC 14, AC 15, AC 16, AC 27`
- `C8 -> AC 19, AC 21`
