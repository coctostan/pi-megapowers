---
id: 5
title: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/ui-issue-list.ts
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-command-custom-list.test.ts
---

### Task 5: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss [depends: 1, 2, 3, 4]

Covers AC: 1, 11, 13, 19, 21, 25, 27
**Files:**
- Modify: `extensions/megapowers/ui-issue-list.ts`
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-custom-list.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-custom-list.test.ts` with:
```ts
import { describe, expect, it } from "bun:test";
import type { Issue } from "../extensions/megapowers/state/store.js";
import { buildIssueListRows, showIssueListUI } from "../extensions/megapowers/ui-issue-list.js";
const ESC = "\u001b";
const ENTER = "\r";
const DOWN = "\u001b[B";
const BACKSPACE = "\u007f";
const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};
function issue(id: number, slug: string, title: string, status: Issue["status"]): Issue {
  return {
    id,
    slug,
    title,
    type: "feature",
    status,
    description: `${title} full description`,
    createdAt: id,
    sources: [],
    milestone: "M1",
    priority: id,
  };
}
async function driveWidget(
  rows: ReturnType<typeof buildIssueListRows>,
  activeIssueSlug: string | null,
  inputs: string[],
) {
  const renders: string[] = [];
  let result: Awaited<ReturnType<typeof showIssueListUI>> | undefined;
  const ctx = {
    hasUI: true,
    ui: {
      custom: async <T>(factory: any): Promise<T> => {
        const tui = {
          requestRender() {
            renders.push(widget.render(80).join("\n"));
          },
        };
        const done = (value: T) => {
          result = value;
        };
        const widget = factory(tui, theme, null, done);
        renders.push(widget.render(80).join("\n"));
        for (const input of inputs) {
          widget.handleInput(input);
          renders.push(widget.render(80).join("\n"));
          if (result !== undefined) break;
        }
        return result as T;
      },
    },
  };
  result = await showIssueListUI(ctx as any, rows, activeIssueSlug);
  return { result, renders };
}
describe("showIssueListUI", () => {
  it("renders list view, opens action menu, supports detail view return, and dismisses with Escape", async () => {
    const active = issue(2, "002-active", "Active issue", "in-progress");
    const other = issue(1, "001-other", "Other issue", "open");
    const rows = buildIssueListRows([other, active], active.slug, () => null);
    const dismissed = await driveWidget(rows, active.slug, [ESC]);
    expect(dismissed.result).toBeNull();
    const menuEscape = await driveWidget(rows, active.slug, [ENTER, ESC, ESC]);
    expect(menuEscape.result).toBeNull();
    expect(menuEscape.renders.some((screen) => screen.includes("Issue list"))).toBe(true);
    expect(menuEscape.renders.some((screen) => screen.includes("Open/Activate"))).toBe(true);
    const detail = await driveWidget(rows, active.slug, [ENTER, DOWN, DOWN, ENTER, BACKSPACE, ESC]);
    expect(detail.result).toBeNull();
    expect(detail.renders.some((screen) => screen.includes("Other issue full description"))).toBe(true);
    expect(detail.renders.some((screen) => screen.includes("Issue list"))).toBe(true);
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-custom-list.test.ts`
Expected: FAIL — `Export named 'showIssueListUI' not found in module '../extensions/megapowers/ui-issue-list.js'`
**Step 3 — Write minimal implementation**
At the top of `extensions/megapowers/ui-issue-list.ts`, add:
```ts
import { Key, matchesKey } from "@mariozechner/pi-tui";
```

Reuse the existing `import type { Issue } from "./state/store.js"` from Task 1; do not add a second `Issue` import in the middle of the file.

Then append these exports to `extensions/megapowers/ui-issue-list.ts`:

```ts
export type IssueListResult =
  | null
  | { type: "create" }
  | { type: "issue-action"; action: IssueActionKey; issue: Issue };
type WidgetView =
  | IssueListViewState
  | { screen: "menu"; rowIndex: number; actionIndex: number };

export function renderIssueActionMenuScreen(
  issue: Issue,
  items: IssueActionItem[],
  actionIndex: number,
  _width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  lines.push(theme.fg("accent", "Issue actions"));
  lines.push(theme.bold(`#${String(issue.id).padStart(3, "0")} ${issue.title}`));
  lines.push("");
  for (let i = 0; i < items.length; i++) {
    const prefix = i === actionIndex ? "> " : "  ";
    lines.push(`${prefix}${items[i].label}`);
  }
  lines.push("");
  lines.push("↑↓ navigate • Enter select • Esc back");
  return lines;
}
export async function showIssueListUI(
  ctx: { hasUI: boolean; ui: { custom: <T>(fn: any) => Promise<T> } },
  rows: IssueListRow[],
  activeIssueSlug: string | null,
): Promise<IssueListResult> {
  if (!ctx.hasUI) return null;
  return ctx.ui.custom<IssueListResult>((tui: any, theme: any, _kb: any, done: (value: IssueListResult) => void) => {
    let view: WidgetView = { screen: "list", cursor: findFirstFocusableRow(rows) };
    function refresh() {
      tui.requestRender();
    }
    function getMenuItems(menuView: Extract<WidgetView, { screen: "menu" }>): IssueActionItem[] {
      const row = rows[menuView.rowIndex];
      return row?.kind === "issue" ? buildIssueActionItems(row.issue, activeIssueSlug) : [];
    }

    return {
      render: (width: number) => {
        if (view.screen === "detail") {
          return renderIssueDetailScreen(view.issue, width, theme);
        }
        if (view.screen === "menu") {
          const row = rows[view.rowIndex];
          const items = getMenuItems(view);
          return row?.kind === "issue"
            ? renderIssueActionMenuScreen(row.issue, items, view.actionIndex, width, theme)
            : renderIssueListScreen(rows, findFirstFocusableRow(rows), width, theme);
        }
        return renderIssueListScreen(rows, view.cursor, width, theme);
      },
      invalidate: () => {},
      handleInput: (data: string) => {
        if (view.screen === "detail") {
          if (matchesKey(data, Key.escape) || matchesKey(data, Key.backspace)) {
            view = returnToListView(view);
            refresh();
          }
          return;
        }

        if (view.screen === "menu") {
          const items = getMenuItems(view);
          if (matchesKey(data, Key.up)) {
            view = { ...view, actionIndex: Math.max(0, view.actionIndex - 1) };
            refresh();
            return;
          }
          if (matchesKey(data, Key.down) || matchesKey(data, Key.tab)) {
            view = { ...view, actionIndex: Math.min(items.length - 1, view.actionIndex + 1) };
            refresh();
            return;
          }
          if (matchesKey(data, Key.escape)) {
            view = { screen: "list", cursor: view.rowIndex };
            refresh();
            return;
          }
          if (matchesKey(data, Key.enter)) {
            const row = rows[view.rowIndex];
            const selected = items[view.actionIndex];
            if (row?.kind !== "issue" || !selected) return;
            if (selected.key === "view") {
              view = openIssueDetailView(row.issue, view.rowIndex);
              refresh();
              return;
            }
            done({ type: "issue-action", action: selected.key, issue: row.issue });
          }
          return;
        }

        if (matchesKey(data, Key.up)) {
          view = { screen: "list", cursor: moveIssueListCursor(rows, view.cursor, "up") };
          refresh();
          return;
        }
        if (matchesKey(data, Key.down) || matchesKey(data, Key.tab)) {
          view = { screen: "list", cursor: moveIssueListCursor(rows, view.cursor, "down") };
          refresh();
          return;
        }
        if (matchesKey(data, Key.escape)) {
          done(null);
          return;
        }
        if (matchesKey(data, Key.enter)) {
          const row = rows[view.cursor];
          if (row?.kind === "create") {
            done({ type: "create" });
            return;
          }
          if (row?.kind === "issue") {
            view = { screen: "menu", rowIndex: view.cursor, actionIndex: 0 };
            refresh();
          }
        }
      },
    };
  });
}
```

Then replace the `if (subcommand === "list") { ... }` branch in `extensions/megapowers/ui.ts` with:

```ts
      if (subcommand === "list") {
        const issues = sortActiveIssues(store.listIssues().filter(i => i.status !== "done"));
        if (issues.length === 0) {
          ctx.ui.notify("No open issues. Use /issue new to create one.", "info");
          return state;
        }
        const rows = buildIssueListRows(issues, state.activeIssue, (issueId) => store.getBatchForIssue(issueId));
        const result = await showIssueListUI(ctx as any, rows, state.activeIssue);
        if (!result) return state;
        return state;
      }
```

Also add this import near the top of `extensions/megapowers/ui.ts`:

```ts
import { buildIssueListRows, showIssueListUI } from "./ui-issue-list.js";
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-custom-list.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
