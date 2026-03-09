## Task 2: Add cursor navigation and focused-row rendering

The task content is workable, but the AC mapping is wrong.

- Change the `Covers AC:` line from:
  - `Covers AC: 4, 6, 7, 8, 20, 26, 27`
- To:
  - `Covers AC: 4, 6, 7, 8, 26, 27`

AC 20 is the detail-screen-content requirement. It belongs in Task 4, not the navigation task.

## Task 4: Add in-widget detail view rendering and return state

This task is currently malformed and will not parse.

### Fix the task structure
Restore all five step headings explicitly:
- `**Step 1 — Write the failing test**`
- `**Step 2 — Run test, verify it fails**`
- `**Step 3 — Write minimal implementation**`
- `**Step 4 — Run test, verify it passes**`
- `**Step 5 — Verify no regressions**`

### Fix Step 1 test code
The test block is missing the `theme` declaration, the `rendered` variable, and the assertion for returning to the prior list cursor.

Use a syntactically complete test like this:

```ts
import { describe, expect, it } from "bun:test";
import type { Issue } from "../extensions/megapowers/state/store.js";
import {
  openIssueDetailView,
  returnToListView,
  renderIssueDetailScreen,
} from "../extensions/megapowers/ui-issue-list.js";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const issue: Issue = {
  id: 12,
  slug: "012-full-detail-view",
  title: "Full detail view",
  type: "feature",
  status: "open",
  description: "First paragraph\n\nSecond paragraph with more detail.",
  createdAt: 12,
  sources: [],
  milestone: "M2",
  priority: 2,
};

describe("issue-list detail view", () => {
  it("renders the full issue contents and returns to the prior list cursor", () => {
    const detail = openIssueDetailView(issue, 4);
    expect(detail.screen).toBe("detail");
    expect(detail.returnCursor).toBe(4);

    const rendered = renderIssueDetailScreen(issue, 80, theme as any).join("\n");
    expect(rendered).toContain("Full detail view");
    expect(rendered).toContain("First paragraph");
    expect(rendered).toContain("Second paragraph with more detail.");
    expect(rendered).toContain("Back");

    expect(returnToListView(detail)).toEqual({ screen: "list", cursor: 4 });
  });
});
```

### Fix Step 2 expected failure
Once Step 1 is syntactically valid, the expected failure can be the missing export:

- `Expected: FAIL — Export named 'openIssueDetailView' not found in module '../extensions/megapowers/ui-issue-list.js'`

Do not leave Step 1 in a parse-error state.

### Fix Step 3 implementation snippet
The snippet currently omits the function declaration for `openIssueDetailView()`.

It should include:

```ts
export type IssueListViewState =
  | { screen: "list"; cursor: number }
  | { screen: "detail"; issue: Issue; returnCursor: number };

export function openIssueDetailView(issue: Issue, returnCursor: number): IssueListViewState {
  return { screen: "detail", issue, returnCursor };
}

export function returnToListView(view: Extract<IssueListViewState, { screen: "detail" }>): IssueListViewState {
  return { screen: "list", cursor: view.returnCursor };
}

export function renderIssueDetailScreen(
  issue: Issue,
  _width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  lines.push(theme.bold(`#${String(issue.id).padStart(3, "0")} ${issue.title}`));
  lines.push(`${issue.type} • ${issue.status} • milestone ${issue.milestone || "none"}`);
  lines.push("");
  for (const line of issue.description.split("\n")) {
    lines.push(line);
  }
  lines.push("");
  lines.push(theme.fg("accent", "Back"));
  lines.push(theme.fg("dim", "Esc or Backspace to return to the list"));
  return lines;
}
```

## Task 5: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss

This task is too broad for one TDD slice.

### Narrow the task scope to the widget shell
Keep this task focused on replacing `ctx.ui.select()` with `ctx.ui.custom()` and proving the widget can:
- render the list screen,
- open an issue action menu from Enter on an issue row,
- dismiss on Escape from the list,
- return to the list after leaving the menu/detail view.

Do **not** make Task 5 responsible for the create-row routing in `ui.ts`; Task 6 already owns that.

### Fix the AC mapping
Remove AC 12 from Task 5. That belongs to Task 6.

Change:
- `Covers AC: 1, 11, 12, 13, 19, 21, 25, 27`

To something equivalent to:
- `Covers AC: 1, 11, 13, 19, 21, 25, 27`

### Simplify Step 1 test
Remove the create-row assertion from this task. Keep the test focused on widget behavior, not downstream `/issue new` routing.

In other words, delete this section from Step 1:

```ts
const create = await driveWidget(rows, active.slug, [DOWN, DOWN, ENTER]);
expect(create.result).toEqual({ type: "create" });
```

If you want create-row behavior in the widget test, only assert the widget returns `{ type: "create" }`; do not also test the `/issue new` flow here. Task 6 already covers the routing into `handleIssueCommand(..., "new")`.

### Trim Step 3 to the minimum implementation needed for Task 5
Keep the `extensions/megapowers/ui.ts` change limited to swapping the `/issue list` branch over to:

```ts
const rows = buildIssueListRows(issues, state.activeIssue, (issueId) => store.getBatchForIssue(issueId));
const result = await showIssueListUI(ctx as any, rows, state.activeIssue);
if (!result) return state;
return state;
```

Do not add create/open/archive/close routing logic in Task 5. Those belong in Tasks 6-9.

## Task 6: Route the create row into the existing new-issue flow

### Fix the `showIssueListUI()` call signature in Step 3
`showIssueListUI()` is introduced in Task 5 with the signature:

```ts
showIssueListUI(ctx, rows, activeIssueSlug)
```

So Step 3 must pass the active issue slug.

Replace:

```ts
const result = await showIssueListUI(ctx as any, rows);
```

With:

```ts
const result = await showIssueListUI(ctx as any, rows, state.activeIssue);
```

### Preserve result handling order
The create branch should appear before the final `return state;` and should preserve all earlier Task 5 behavior.

## Task 7: Route Open/Activate through the existing activation path

### Fix dependencies
This task edits the same `/issue list` result-handling block as Task 6, so it must depend on Task 6.

Change the frontmatter and header annotation from:
- `depends_on: [5]`
- `[depends: 5]`

To:
- `depends_on: [6]`
- `[depends: 6]`

(Task 6 already depends on Task 5, so this preserves the full chain.)

### Preserve the create branch from Task 6
In Step 3, make it explicit that the new `open` branch is added **after** the existing create branch, not as a replacement for the whole result block.

## Task 8: Route Archive through the existing archive behavior

### Fix dependencies
This task edits the same result-handling block as Tasks 6 and 7. It must depend on Task 7.

Change:
- `depends_on: [5]`
- `[depends: 5]`

To:
- `depends_on: [7]`
- `[depends: 7]`

### Preserve earlier result handlers
In Step 3, state explicitly that the archive branch is inserted alongside the existing create/open branches without removing them.

## Task 9: Route close actions through existing state and phase behavior

### Fix dependencies
This task edits the same result-handling block as Tasks 6-8. It must depend on Task 8.

Change:
- `depends_on: [5]`
- `[depends: 5]`

To:
- `depends_on: [8]`
- `[depends: 8]`

### Fix granularity in Step 1
The current single `it(...)` covers three different actions (`close`, `close-now`, `go-to-done`) in one test body. Split that into three focused `it(...)` cases inside the same test file:
- one for closing a non-active issue,
- one for `close-now` on the active issue,
- one for `go-to-done` on the active issue.

Keep the same file path: `tests/ui-issue-command-close-actions.test.ts`.

### Update Step 2 expected failure
After splitting Step 1, make Step 2 name the first failing assertion you expect from the first focused test. For example:

- `Expected: FAIL — Expected: "done" Received: "open"`

### Preserve earlier result handlers in Step 3
Make it explicit that the `close`, `close-now`, and `go-to-done` branches are appended after the existing create/open/archive handlers from Tasks 6-8, not written as a replacement block.
