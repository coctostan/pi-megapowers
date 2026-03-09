---
id: 2
title: Add cursor navigation and focused-row rendering
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/ui-issue-list.ts
files_to_create:
  - tests/ui-issue-list-navigation.test.ts
---

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
