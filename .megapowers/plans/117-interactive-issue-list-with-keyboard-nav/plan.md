# Plan

### Task 1: Build grouped issue-list rows for the custom widget

### Task 1: Build grouped issue-list rows for the custom widget

Covers AC: 2, 3, 4, 5, 9, 10, 26

**Files:**
- Create: `extensions/megapowers/ui-issue-list.ts`
- Test: `tests/ui-issue-list-rows.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-list-rows.test.ts` with:

```ts
import { describe, expect, it } from "bun:test";
import type { Issue } from "../extensions/megapowers/state/store.js";
import { buildIssueListRows } from "../extensions/megapowers/ui-issue-list.js";

function issue(partial: Partial<Issue> & Pick<Issue, "id" | "slug" | "title" | "status" | "type" | "description" | "createdAt" | "sources">): Issue {
  return {
    milestone: undefined,
    priority: undefined,
    ...partial,
  };
}

describe("buildIssueListRows", () => {
  it("builds milestone headers, non-focusable header rows, active markers, status labels, and a trailing create row", () => {
    const rows = buildIssueListRows(
      [
        issue({
          id: 1,
          slug: "001-m1-top",
          title: "M1 top",
          type: "feature",
          status: "open",
          description: "first",
          createdAt: 1,
          sources: [],
          milestone: "M1",
          priority: 1,
        }),
        issue({
          id: 2,
          slug: "002-m1-next",
          title: "M1 next",
          type: "bugfix",
          status: "in-progress",
          description: "second",
          createdAt: 2,
          sources: [],
          milestone: "M1",
          priority: 2,
        }),
        issue({
          id: 3,
          slug: "003-m2-item",
          title: "M2 item",
          type: "feature",
          status: "open",
          description: "third",
          createdAt: 3,
          sources: [],
          milestone: "M2",
          priority: 1,
        }),
      ],
      "002-m1-next",
      () => null,
    );

    expect(rows.map((row) => row.kind)).toEqual([
      "milestone",
      "issue",
      "issue",
      "milestone",
      "issue",
      "create",
    ]);

    expect(rows[0]).toMatchObject({ kind: "milestone", focusable: false, label: "M1: (2 issues)" });
    expect(rows[1]).toMatchObject({ kind: "issue", focusable: true });
    expect(rows[2]).toMatchObject({ kind: "issue", focusable: true, isActive: true });
    expect(rows[2].label).toContain("● active");
    expect(rows[1].label).toContain("[open]");
    expect(rows[2].label).toContain("[in-progress]");
    expect(rows.at(-1)).toMatchObject({ kind: "create", focusable: true, label: "+ Create new issue..." });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-list-rows.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/ui-issue-list.js'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/ui-issue-list.ts` with:

```ts
import type { Issue } from "./state/store.js";

export type IssueListRow =
  | {
      kind: "milestone";
      key: string;
      label: string;
      focusable: false;
      milestone: string;
    }
  | {
      kind: "issue";
      key: string;
      label: string;
      focusable: true;
      issue: Issue;
      isActive: boolean;
    }
  | {
      kind: "create";
      key: "create";
      label: string;
      focusable: true;
    };

function formatMilestoneHeader(milestone: string, count: number): string {
  return `${milestone}: (${count} issue${count === 1 ? "" : "s"})`;
}

function formatIssueRowLabel(issue: Issue, isActive: boolean, batchSlug: string | null): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  const priority = typeof issue.priority === "number" ? ` [P${issue.priority}]` : "";
  const batch = batchSlug ? ` (in batch ${batchSlug})` : "";
  const active = isActive ? " ● active" : "";
  return `${id}${priority} ${issue.title} [${issue.status}]${batch}${active}`;
}

export function buildIssueListRows(
  issues: Issue[],
  activeIssueSlug: string | null,
  getBatchForIssue: (issueId: number) => string | null = () => null,
): IssueListRow[] {
  const rows: IssueListRow[] = [];
  let currentMilestone: string | null = null;
  let currentMilestoneCount = 0;
  let currentMilestoneHeaderIndex = -1;

  for (const issue of issues) {
    const milestone = issue.milestone || "none";
    if (milestone !== currentMilestone) {
      currentMilestone = milestone;
      currentMilestoneCount = 0;
      currentMilestoneHeaderIndex = rows.length;
      rows.push({
        kind: "milestone",
        key: `milestone:${milestone}`,
        label: formatMilestoneHeader(milestone, 0),
        focusable: false,
        milestone,
      });
    }

    currentMilestoneCount += 1;
    rows[currentMilestoneHeaderIndex] = {
      kind: "milestone",
      key: `milestone:${milestone}`,
      label: formatMilestoneHeader(milestone, currentMilestoneCount),
      focusable: false,
      milestone,
    };

    const isActive = issue.slug === activeIssueSlug;
    rows.push({
      kind: "issue",
      key: issue.slug,
      label: formatIssueRowLabel(issue, isActive, getBatchForIssue(issue.id)),
      focusable: true,
      issue,
      isActive,
    });
  }

  rows.push({ kind: "create", key: "create", label: "+ Create new issue...", focusable: true });
  return rows;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-list-rows.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Add cursor navigation and focused-row rendering [depends: 1]

### Task 2: Add cursor navigation and focused-row rendering [depends: 1]

Covers AC: 4, 6, 7, 8, 26, 27

**Files:**
- Modify: `extensions/megapowers/ui-issue-list.ts`
- Test: `tests/ui-issue-list-navigation.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-list-navigation.test.ts` with:

```ts
import { describe, expect, it } from "bun:test";
import type { Issue } from "../extensions/megapowers/state/store.js";
import {
  buildIssueListRows,
  findFirstFocusableRow,
  moveIssueListCursor,
  renderIssueListScreen,
} from "../extensions/megapowers/ui-issue-list.js";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function issue(id: number, slug: string, title: string, milestone: string): Issue {
  return {
    id,
    slug,
    title,
    type: "feature",
    status: "open",
    description: title,
    createdAt: id,
    sources: [],
    milestone,
    priority: id,
  };
}

describe("issue-list navigation", () => {
  it("moves through actionable rows with arrow keys and Tab while skipping milestone headers and rendering a focus cursor", () => {
    const rows = buildIssueListRows(
      [issue(1, "001-a", "A", "M1"), issue(2, "002-b", "B", "M1"), issue(3, "003-c", "C", "M2")],
      null,
      () => null,
    );

    const start = findFirstFocusableRow(rows);
    expect(start).toBe(1);

    const down = moveIssueListCursor(rows, start, "down");
    expect(down).toBe(2);

    const tab = moveIssueListCursor(rows, down, "tab");
    expect(tab).toBe(4);

    const create = moveIssueListCursor(rows, tab, "down");
    expect(rows[create]).toMatchObject({ kind: "create" });

    const up = moveIssueListCursor(rows, create, "up");
    expect(up).toBe(4);

    const rendered = renderIssueListScreen(rows, tab, 80, theme as any).join("\n");
    expect(rendered).toContain("> #003 [P3] C [open]");
    expect(rendered).toContain("+ Create new issue...");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-list-navigation.test.ts`
Expected: FAIL — `Export named 'findFirstFocusableRow' not found in module '../extensions/megapowers/ui-issue-list.js'`

**Step 3 — Write minimal implementation**
Append these exports to `extensions/megapowers/ui-issue-list.ts`:

```ts
export type NavigationKey = "up" | "down" | "tab";

export function findFirstFocusableRow(rows: IssueListRow[]): number {
  const index = rows.findIndex((row) => row.focusable);
  return index >= 0 ? index : 0;
}

export function moveIssueListCursor(rows: IssueListRow[], cursor: number, key: NavigationKey): number {
  if (rows.length === 0) return 0;
  const delta = key === "up" ? -1 : 1;
  let next = cursor;

  while (true) {
    const candidate = next + delta;
    if (candidate < 0 || candidate >= rows.length) {
      return next;
    }
    next = candidate;
    if (rows[next]?.focusable) {
      return next;
    }
  }
}

export function renderIssueListScreen(
  rows: IssueListRow[],
  cursor: number,
  _width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  lines.push(theme.fg("accent", "Issue list"));
  lines.push("");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind === "milestone") {
      lines.push(theme.bold(row.label));
      continue;
    }

    const prefix = i === cursor ? "> " : "  ";
    lines.push(`${prefix}${row.label}`);
  }

  lines.push("");
  lines.push("↑↓ navigate • Tab next • Enter select • Esc cancel");
  return lines;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-list-navigation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Define per-issue action menus for active and non-active rows [depends: 1]

### Task 3: Define per-issue action menus for active and non-active rows [depends: 1]

Covers AC: 13, 14, 15, 16, 27

**Files:**
- Modify: `extensions/megapowers/ui-issue-list.ts`
- Test: `tests/ui-issue-list-actions.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-list-actions.test.ts` with:

```ts
import { describe, expect, it } from "bun:test";
import type { Issue } from "../extensions/megapowers/state/store.js";
import { buildIssueActionItems } from "../extensions/megapowers/ui-issue-list.js";

const issue: Issue = {
  id: 7,
  slug: "007-widget-action-menu",
  title: "Widget action menu",
  type: "feature",
  status: "in-progress",
  description: "desc",
  createdAt: 7,
  sources: [],
  milestone: "M1",
  priority: 1,
};

describe("buildIssueActionItems", () => {
  it("returns the required base actions for non-active issues and the active-only actions for the active issue", () => {
    const nonActive = buildIssueActionItems(issue, null).map((item) => item.label);
    expect(nonActive).toEqual(["Open/Activate", "Archive", "View", "Close"]);

    const active = buildIssueActionItems(issue, issue.slug).map((item) => item.label);
    expect(active).toEqual(["Open/Activate", "Archive", "View", "Close now", "Go to done phase"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-list-actions.test.ts`
Expected: FAIL — `Export named 'buildIssueActionItems' not found in module '../extensions/megapowers/ui-issue-list.js'`

**Step 3 — Write minimal implementation**
Append these exports to `extensions/megapowers/ui-issue-list.ts`:

```ts
export type IssueActionKey = "open" | "archive" | "view" | "close" | "close-now" | "go-to-done";

export interface IssueActionItem {
  key: IssueActionKey;
  label: string;
}

export function buildIssueActionItems(issue: Issue, activeIssueSlug: string | null): IssueActionItem[] {
  const items: IssueActionItem[] = [
    { key: "open", label: "Open/Activate" },
    { key: "archive", label: "Archive" },
    { key: "view", label: "View" },
  ];

  if (issue.slug === activeIssueSlug) {
    items.push({ key: "close-now", label: "Close now" });
    items.push({ key: "go-to-done", label: "Go to done phase" });
  } else {
    items.push({ key: "close", label: "Close" });
  }

  return items;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-list-actions.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Add in-widget detail view rendering and return state [depends: 1]

### Task 4: Add in-widget detail view rendering and return state [depends: 1]

Covers AC: 19, 20, 21, 27
**Files:**
- Modify: `extensions/megapowers/ui-issue-list.ts`
- Test: `tests/ui-issue-list-detail.test.ts`
**Step 1 — Write the failing test**
Create `tests/ui-issue-list-detail.test.ts` with:
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
**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-list-detail.test.ts`
Expected: FAIL — `Export named 'openIssueDetailView' not found in module '../extensions/megapowers/ui-issue-list.js'`
**Step 3 — Write minimal implementation**
Append these exports to `extensions/megapowers/ui-issue-list.ts`:
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
**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-list-detail.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss [depends: 1, 2, 3, 4]

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

### Task 6: Route the create row into the existing new-issue flow [depends: 5]

### Task 6: Route the create row into the existing new-issue flow [depends: 5]

Covers AC: 12, 25

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-create-row.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-create-row.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-create-row-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("create row action", () => {
  it("enters the existing issue creation flow when the widget returns a create action", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const state = createInitialState();
    store.createIssue("Existing issue", "feature", "desc", undefined, "M1", 1);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "create" }),
        select: async (prompt: string) => (prompt.includes("Issue type") ? "feature" : null),
        input: async () => "Created from widget",
        editor: async () => "Widget-created description",
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(nextState.activeIssue).toBe("002-created-from-widget");
    expect(nextState.workflow).toBe("feature");
    expect(store.getIssue("002-created-from-widget")?.status).toBe("in-progress");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-create-row.test.ts`
Expected: FAIL — `Expected: "002-created-from-widget" Received: null`

**Step 3 — Write minimal implementation**
Update the `/issue list` branch in `extensions/megapowers/ui.ts` so the custom-widget result handles the create row before returning:

```ts
        const result = await showIssueListUI(ctx as any, rows, state.activeIssue);
        if (!result) return state;
        if (result.type === "create") {
          return this.handleIssueCommand(ctx, state, store, "new");
        }

        return state;
```

Keep this `create` branch before the final `return state;` and preserve all existing Task 5 handling unchanged.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-create-row.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Route Open/Activate through the existing activation path [depends: 6]

### Task 7: Route Open/Activate through the existing activation path [depends: 6]

Covers AC: 17, 25

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-open-action.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-open-action.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-open-action-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Open/Activate action", () => {
  it("activates the selected issue with the same state reset used by the old `/issue list` flow", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const target = store.createIssue("Target issue", "bugfix", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: "999-old-issue",
      workflow: "feature" as const,
      phase: "plan" as const,
      completedTasks: [1, 2],
      currentTaskIndex: 2,
      tddTaskState: { taskIndex: 2, state: "impl-allowed" as const, skipped: false },
    };

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "open", issue: target }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(nextState.activeIssue).toBe(target.slug);
    expect(nextState.workflow).toBe("bugfix");
    expect(nextState.phase).toBe("reproduce");
    expect(nextState.completedTasks).toEqual([]);
    expect(nextState.currentTaskIndex).toBe(0);
    expect(nextState.tddTaskState).toBeNull();
    expect(store.getIssue(target.slug)?.status).toBe("in-progress");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-open-action.test.ts`
Expected: FAIL — `Expected: "001-target-issue" Received: "999-old-issue"`

**Step 3 — Write minimal implementation**
Extend the `/issue list` result handling in `extensions/megapowers/ui.ts` by adding this branch **after** the existing `create` branch from Task 6 (do not replace the whole result block):

```ts
        if (result.type === "issue-action" && result.action === "open") {
          const selected = result.issue;
          const firstPhase = getFirstPhase(selected.type);
          const newState: MegapowersState = {
            ...state,
            activeIssue: selected.slug,
            workflow: selected.type,
            phase: firstPhase,
            phaseHistory: [],
            reviewApproved: false,
            currentTaskIndex: 0,
            completedTasks: [],
            tddTaskState: null,
            doneActions: [],
          };
          writeState(ctx.cwd, newState);
          store.updateIssueStatus(selected.slug, "in-progress");
          ctx.ui.notify(`Activated: ${selected.slug}`, "info");
          this.renderDashboard(ctx, newState, store);
          return newState;
        }
```

Keep the existing outer `commands.ts` activation/VCS behavior unchanged; this task only restores the UI-side state mutation path.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-open-action.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: Route Archive through the existing archive behavior [depends: 7]

### Task 8: Route Archive through the existing archive behavior [depends: 7]

Covers AC: 18, 25

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-archive-action.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-archive-action.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-archive-action-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Archive action", () => {
  it("archives the selected issue via the existing store archive path", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const target = store.createIssue("Archive me", "feature", "desc", undefined, "M1", 1);
    const state = createInitialState();

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "archive", issue: target }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    await ui.handleIssueCommand(ctx as any, state, store, "list");

    expect(store.getIssue(target.slug)).toBeNull();
    expect(store.listArchivedIssues().some((issue) => issue.slug === target.slug)).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-archive-action.test.ts`
Expected: FAIL — `Expected: true Received: false`

**Step 3 — Write minimal implementation**
Extend the `/issue list` result handling in `extensions/megapowers/ui.ts` with the same archive logic currently used by `/issue archive <slug>`, inserted alongside the existing `create` and `open` branches (do not remove earlier handlers):

```ts
        if (result.type === "issue-action" && result.action === "archive") {
          const archiveResult = store.archiveIssue(result.issue.slug);
          if (!archiveResult.ok) {
            ctx.ui.notify(archiveResult.error, "error");
            return state;
          }

          ctx.ui.notify(`Archived: ${result.issue.slug}`, "info");
          if (state.activeIssue === result.issue.slug) {
            const resetState: MegapowersState = {
              ...createInitialState(),
              megaEnabled: state.megaEnabled,
              branchName: state.branchName,
              baseBranch: state.baseBranch,
            };
            writeState(ctx.cwd, resetState);
            this.renderDashboard(ctx, resetState, store);
            return resetState;
          }

          this.renderDashboard(ctx, state, store);
          return state;
        }
```

This task should deliberately reuse the same reset behavior already present in the `archive` subcommand branch.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-archive-action.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: Route close actions through existing state and phase behavior [depends: 8]

### Task 9: Route close actions through existing state and phase behavior [depends: 8]

Covers AC: 22, 23, 24, 25
**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-close-actions.test.ts`
**Step 1 — Write the failing test**
Create `tests/ui-issue-command-close-actions.test.ts` with:
```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";
let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-close-actions-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});
describe("close actions", () => {
  it("closes a non-active issue and keeps the active issue unchanged", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const nonActive = store.createIssue("Non active close", "feature", "desc", undefined, "M1", 1);
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 2);
    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "verify" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "close", issue: nonActive }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterClose = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(nonActive.slug)?.status).toBe("done");
    expect(afterClose.activeIssue).toBe(active.slug);
  });
  it("closes the active issue immediately for close-now", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "verify" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "close-now", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterCloseNow = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(active.slug)?.status).toBe("done");
    expect(afterCloseNow.activeIssue).toBeNull();
  });
  it("sends the active issue to done phase for go-to-done", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "code-review" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "go-to-done", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterDone = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(afterDone.phase).toBe("done");
    expect(readState(tmp).phase).toBe("done");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-close-actions.test.ts`
Expected: FAIL — `Expected: "done" Received: "open"`
**Step 3 — Write minimal implementation**
At the top of `extensions/megapowers/ui.ts`, add:
```ts
import { handleSignal } from "./tools/tool-signal.js";
```

Then extend the `/issue list` result handling in `extensions/megapowers/ui.ts` by appending these branches **after** the existing `create`, `open`, and `archive` handlers from Tasks 6-8 (do not replace earlier handlers):

```ts
        if (result.type === "issue-action" && result.action === "close") {
          store.updateIssueStatus(result.issue.slug, "done");
          ctx.ui.notify(`Closed: ${result.issue.slug}`, "info");
          this.renderDashboard(ctx, state, store);
          return state;
        }
        if (result.type === "issue-action" && result.action === "close-now") {
          store.updateIssueStatus(result.issue.slug, "done");
          const resetState: MegapowersState = {
            ...createInitialState(),
            megaEnabled: state.megaEnabled,
            branchName: state.branchName,
            baseBranch: state.baseBranch,
          };
          writeState(ctx.cwd, resetState);
          this.renderDashboard(ctx, resetState, store);
          return resetState;
        }
        if (result.type === "issue-action" && result.action === "go-to-done") {
          writeState(ctx.cwd, state);
          const signal = handleSignal(ctx.cwd, "phase_next", "done");
          if (signal.error) {
            ctx.ui.notify(signal.error, "error");
            return state;
          }
          const nextState = readState(ctx.cwd);
          this.renderDashboard(ctx, nextState, store);
          return nextState;
        }
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-close-actions.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
