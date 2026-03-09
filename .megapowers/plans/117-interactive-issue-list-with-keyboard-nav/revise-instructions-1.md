## Task 4: Add in-widget detail view rendering and return state

Narrow this task so it only covers the detail-view state/rendering work it actually implements.

### What to change
- Remove Task 3 from `depends_on`. Task 4 does not use `buildIssueActionItems()`; it only needs the issue row/state types from Task 1.
- Fix the `Covers AC:` line. Task 4 should cover **AC 19, 20, 21, 27** only. Do **not** claim AC 17 or AC 18 here; those are routed by the action handlers in later tasks.
- Keep the pure detail-state helpers in `extensions/megapowers/ui-issue-list.ts`:
  - `openIssueDetailView(issue: Issue, returnCursor: number)`
  - `returnToListView(view: Extract<IssueListViewState, { screen: "detail" }>)`
  - `renderIssueDetailScreen(issue, width, theme)`

### Why
The current dependency and AC mapping are inaccurate. The codebase APIs in `extensions/megapowers/ui.ts` already handle activation/archive elsewhere; this task should stay self-contained around detail rendering only.

## Task 5: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss

Task 5 is the critical gap. Its Step 3 must implement the actual interactive flow, not only cursor movement.

### 1) Fix the code insertion instructions
The current Step 3 says to "append" code to `extensions/megapowers/ui-issue-list.ts` but the snippet starts with imports:

```ts
import { Key, matchesKey } from "@mariozechner/pi-tui";
import type { Issue } from "./state/store.js";
```

That cannot be appended in the middle of an existing module. Update the task text so it says:
- add `import { Key, matchesKey } from "@mariozechner/pi-tui";` to the **top** of `extensions/megapowers/ui-issue-list.ts`
- reuse the existing `import type { Issue } from "./state/store.js";` from Task 1 instead of re-declaring it

### 2) Expand `IssueListResult` and widget state so Enter can do real work
Task 5 must cover **AC 1, 11, 12, 13, 19, 21, 25, 27**.

Revise Step 1 so the test exercises all of these behaviors through `showIssueListUI()` directly, not just that `ctx.ui.custom()` is called:
- Escape on the list returns `null`
- Enter on the create row returns `{ type: "create" }`
- Enter on an issue row opens an in-widget action menu
- Choosing `View` switches to the detail screen
- Escape or Backspace from detail returns to the prior list cursor instead of dismissing
- Escape from the action menu returns to the list without mutating anything

### 3) Implement list/menu/detail state inside `showIssueListUI()`
Use the pure helpers from earlier tasks. A correct shape is:

```ts
export type IssueListResult =
  | null
  | { type: "create" }
  | { type: "issue-action"; action: IssueActionKey; issue: Issue };

type WidgetView =
  | { screen: "list"; cursor: number }
  | { screen: "menu"; rowIndex: number; actionIndex: number }
  | { screen: "detail"; issue: Issue; returnCursor: number };
```

Then in `handleInput`:
- when `view.screen === "list"`
  - Up/Down/Tab move between focusable rows using `moveIssueListCursor()`
  - Escape => `done(null)`
  - Enter on `row.kind === "create"` => `done({ type: "create" })`
  - Enter on `row.kind === "issue"` => switch to `{ screen: "menu", rowIndex: view.cursor, actionIndex: 0 }`
- when `view.screen === "menu"`
  - build items with `buildIssueActionItems(row.issue, activeIssueSlug)`
  - Up/Down/Tab move between menu actions
  - Escape => return to `{ screen: "list", cursor: rowIndex }`
  - Enter on `view` => switch to `openIssueDetailView(row.issue, rowIndex)`
  - Enter on any other action => `done({ type: "issue-action", action: selected.key, issue: row.issue })`
- when `view.screen === "detail"`
  - Escape or Backspace => `view = returnToListView(view)`

### 4) Render the correct screen based on current view
Do not always render `renderIssueListScreen(...)`. Switch by state:

```ts
render: (width: number) => {
  if (view.screen === "detail") {
    return renderIssueDetailScreen(view.issue, width, theme);
  }
  if (view.screen === "menu") {
    const row = rows[view.rowIndex];
    const items = row.kind === "issue"
      ? buildIssueActionItems(row.issue, activeIssueSlug)
      : [];
    return renderIssueActionMenuScreen(row.issue, items, view.actionIndex, width, theme);
  }
  return renderIssueListScreen(rows, view.cursor, width, theme);
}
```

Add a pure `renderIssueActionMenuScreen(...)` helper in `extensions/megapowers/ui-issue-list.ts` and test it through the widget interaction test rather than via a separate task.

### 5) Pass `activeIssueSlug` into `showIssueListUI()`
The action menu needs to know whether the selected row is active in order to show:
- non-active: `Close`
- active: `Close now`, `Go to done phase`

So revise the function signature from:

```ts
showIssueListUI(ctx, rows)
```

to:

```ts
showIssueListUI(ctx, rows, activeIssueSlug)
```

and update the `extensions/megapowers/ui.ts` call site accordingly.

### 6) Make Step 2 failure expectations match the new test
Because the revised test will exercise Enter/menu/detail behavior, the current Step 2 message (`Expected: false Received: true`) is no longer specific enough. Replace it with the first concrete failure the new test will hit, e.g. that Enter on a create row still returns `null` or that Enter on an issue row does not open a menu.
