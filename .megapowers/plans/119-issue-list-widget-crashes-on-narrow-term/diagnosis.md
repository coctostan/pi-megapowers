# Diagnosis

## Root Cause
The root cause is a **renderer contract violation in the custom `/issue list` widget**, not the existence of long issue titles by itself.

In the pre-fix implementation introduced by `ae71ea2`, the custom widget render path receives the terminal `width`, but all three screen renderers in `extensions/megapowers/ui-issue-list.ts` ignore it:
- `renderIssueListScreen(..., _width, ...)`
- `renderIssueDetailScreen(..., _width, ...)`
- `renderIssueActionMenuScreen(..., _width, ...)`

Those functions returned raw strings directly from issue data instead of truncating or wrapping them to fit the provided width. Long labels created by `formatIssueRowLabel()` — especially `issue.title` plus the appended `(in batch <slug>)` suffix — therefore flowed unchanged into Pi TUI, which enforces that rendered lines must not exceed terminal width. When a line width exceeded the terminal width, Pi TUI crashed.

This is confirmed by:
1. The crash log showing an over-wide rendered line in the issue-list screen:
   - `Terminal width: 119`
   - `Line 83 visible width: 171`
   - offending row was a long issue label with a long batch suffix.
2. The pre-fix source at `ae71ea2`, where the width parameter is explicitly named `_width` and never used in all three renderers.
3. The working custom-widget pattern in `extensions/megapowers/ui-checklist.ts`, which calls `truncateToWidth(..., width)` for every rendered line.
4. The minimal failing repro test, which shows the pre-fix renderer behavior produces a line of width `198` when asked to render within width `40`.

So the place where correct becomes incorrect is: **issue data is still valid when rows are built; it becomes invalid only when the custom widget renderers emit those labels without applying width constraints.**

## Trace
1. Symptom observed in crash log:
   - `/issue list` crashes while rendering.
   - Log reports `Line 83 visible width: 171` with terminal width `119`.
2. The crashing row content matches the issue-list widget row format:
   - `#085 [P1] ... [closed] (in batch ...)`
3. That format is produced by `formatIssueRowLabel()` in `extensions/megapowers/ui-issue-list.ts:31-37`, which concatenates:
   - issue id
   - priority
   - `issue.title`
   - `[status]`
   - optional `(in batch <slug>)`
   - optional `● active`
4. `buildIssueListRows()` stores that full label in each row at `extensions/megapowers/ui-issue-list.ts:39-85`, specifically `label: formatIssueRowLabel(...)` at line 77.
5. `/issue list` enters the custom widget path from `extensions/megapowers/ui.ts:355-357`, which builds rows and calls `showIssueListUI(...)`.
6. `showIssueListUI()` passes the live terminal width into the screen renderers at `extensions/megapowers/ui-issue-list.ts:245-256`.
7. In the pre-fix implementation (`ae71ea2`), those renderers accepted `_width` but did not use it:
   - `renderIssueListScreen`: old lines 112-135
   - `renderIssueDetailScreen`: old lines 174-189
   - `renderIssueActionMenuScreen`: old lines 201-218
8. Because the renderers pushed raw strings directly into the returned `string[]`, over-wide labels were emitted unchanged.
9. Pi TUI then rejected the over-wide line and crashed.

Conclusion from the trace: the bug is caused by the custom widget renderers failing to honor the width passed down by `ctx.ui.custom()`.

## Affected Code
### Primary broken path
- `extensions/megapowers/ui.ts:355-357`
  - `/issue list` chooses the custom widget path and calls `showIssueListUI(...)`.
- `extensions/megapowers/ui-issue-list.ts:31-37`
  - `formatIssueRowLabel()` builds potentially long labels from issue fields and batch slug.
- `extensions/megapowers/ui-issue-list.ts:39-85`
  - `buildIssueListRows()` stores the unbounded label on each issue row.
- `extensions/megapowers/ui-issue-list.ts:225-256`
  - `showIssueListUI()` receives `width` from Pi TUI and dispatches to the active screen renderer.

### Exact pre-fix renderer defect (`ae71ea2`)
- `extensions/megapowers/ui-issue-list.ts` old lines `112-135`
  - `renderIssueListScreen(rows, cursor, _width, theme)` ignored width and did `lines.push(...)` directly.
- `extensions/megapowers/ui-issue-list.ts` old lines `174-189`
  - `renderIssueDetailScreen(issue, _width, theme)` ignored width and pushed title/description lines directly.
- `extensions/megapowers/ui-issue-list.ts` old lines `201-218`
  - `renderIssueActionMenuScreen(issue, items, actionIndex, _width, theme)` ignored width and pushed lines directly.

### Evidence of the corrected pattern already present elsewhere
- `extensions/megapowers/ui-checklist.ts:87-113`
  - Working widget renderer uses `const add = (s: string) => lines.push(truncateToWidth(s, width));`
  - Every rendered line goes through width truncation before returning to Pi TUI.

### Regression coverage
- `tests/ui-issue-list-width.test.ts:32-49`
  - Width-focused regression test checks all lines from list/detail/menu screens satisfy `visibleWidth(line) <= width`.

## Pattern Analysis
### Working pattern
`extensions/megapowers/ui-checklist.ts` is the closest working example of a custom `ctx.ui.custom()` widget in this codebase.

Relevant behavior:
- It takes `width` in `render(width)`.
- It defines a helper `add()` that always applies `truncateToWidth(..., width)`.
- All user-visible lines flow through that helper.
- Result: the widget never emits a line wider than the terminal.

### Broken pattern
The pre-fix issue-list widget differs in three important ways:
1. It accepted `width` but renamed it `_width`, signaling it was unused.
2. It appended raw strings directly with `lines.push(...)` in all three screen renderers.
3. It rendered unconstrained data fields (`issue.title`, description lines, batch slug suffix) without any width guard.

### Assumption that was violated
The broken code assumed one of these would be true:
- issue labels would usually be short enough, or
- Pi TUI/custom widget infrastructure would clip lines automatically.

The evidence shows both assumptions are false:
- Issue labels can exceed terminal width by a large margin (`171 > 119`, `198 > 40`).
- Pi TUI does not silently clip; it hard-fails when a rendered line exceeds width.

### Why long data is not the root cause
Long titles, descriptions, and batch slugs are valid repository data. The same underlying data only becomes a crash when the custom widget renderers emit it without width handling. That means the data is the trigger, but the renderer contract violation is the root cause.

### Why this escaped initially
Existing issue-list tests covered behavior and content, but not width safety:
- `tests/ui-issue-list-navigation.test.ts:53-55` checks rendered content contains expected text.
- `tests/ui-issue-list-detail.test.ts:33-38` checks detail content contains expected text.

Neither test asserts `visibleWidth(line) <= width`, so the contract break was not exercised until the dedicated width test was added.

## Risk Assessment
Changing this area affects all custom issue-list screens that return text to Pi TUI:
1. **List screen** — long milestone headers and issue rows.
2. **Detail screen** — long issue titles and description paragraphs.
3. **Action menu screen** — long issue titles in the menu header.

Other dependencies/risk points:
- `formatIssueRowLabel()` intentionally includes optional batch slug and active marker, so any future label growth will hit the same rendering boundary if width guards are removed or bypassed.
- `showIssueListUI()` is the single dispatch point for these renderers, so any new screen added there must also honor width.
- Other custom widgets are lower risk if they already follow the checklist pattern, but this bug shows that `ctx.ui.custom()` widgets must handle width explicitly; Pi TUI will not do it for them.

Related bug class to watch for:
- Any other custom widget that returns raw `string[]` lines without `truncateToWidth()` or wrapping could fail the same way under narrow terminals.

## Fixed When
1. Every screen returned by the custom issue-list widget honors the supplied render width: list, detail, and action menu.
2. No line emitted by those screens exceeds terminal width, even with long issue titles, descriptions, or batch slugs.
3. Regression test coverage exists that measures rendered line width directly, not just rendered content.