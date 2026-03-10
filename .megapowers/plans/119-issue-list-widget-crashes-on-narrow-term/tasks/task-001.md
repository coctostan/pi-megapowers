---
id: 1
title: Truncate all issue-list widget renderer output to terminal width
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/ui-issue-list.ts
files_to_create:
  - tests/ui-issue-list-width.test.ts
---

### Task 1: Truncate all issue-list widget renderer output to terminal width

**Covers:** Fixed When 1 (list/detail/action-menu screens honor render width), Fixed When 2 (no emitted line exceeds terminal width for long titles/descriptions/batch slugs), Fixed When 3 (regression test measures rendered line width directly).

**Files:**
- Modify: `extensions/megapowers/ui-issue-list.ts`
- Create: `tests/ui-issue-list-width.test.ts`

**Step 1 — Write the failing test**

Create `tests/ui-issue-list-width.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { visibleWidth } from "@mariozechner/pi-tui";
import type { Issue } from "../extensions/megapowers/state/store.js";
import {
  buildIssueActionItems,
  buildIssueListRows,
  renderIssueActionMenuScreen,
  renderIssueDetailScreen,
  renderIssueListScreen,
} from "../extensions/megapowers/ui-issue-list.js";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const longIssue: Issue = {
  id: 83,
  slug: "083-super-long-issue-title-for-width-regression-coverage",
  title:
    "Super long issue title that should be truncated by the issue list widget instead of overflowing the terminal width",
  type: "feature",
  status: "open",
  description:
    "This is a very long description line that should also be truncated when the detail view is rendered inside a narrow terminal pane.",
  createdAt: 83,
  sources: [],
  milestone: "M1234567890",
  priority: 9,
};

describe("issue-list width handling", () => {
  it("truncates every rendered line across list, detail, and action-menu screens", () => {
    const width = 40;
    const rows = buildIssueListRows([longIssue], longIssue.slug, () => "117-interactive-issue-list-with-keyboard-nav");
    const menuItems = buildIssueActionItems(longIssue, longIssue.slug);

    const screens = [
      renderIssueListScreen(rows, 1, width, theme as any),
      renderIssueDetailScreen(longIssue, width, theme as any),
      renderIssueActionMenuScreen(longIssue, menuItems, 0, width, theme as any),
    ];

    for (const screen of screens) {
      for (const line of screen) {
        expect(visibleWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test ./tests/ui-issue-list-width.test.ts`

Expected: FAIL — `expect(received).toBeLessThanOrEqual(expected)` with `Expected: <= 40` and `Received: 198`

The pre-fix renderers ignore the `width` parameter (named `_width`) and push raw strings directly into the output array, so the long issue label plus batch slug produces a line of visible width 198 which exceeds the requested 40.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui-issue-list.ts`, make three changes:

1. **Add `truncateToWidth` to the import** (line 2):

Change:
```ts
import { Key, matchesKey } from "@mariozechner/pi-tui";
```
To:
```ts
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
```

2. **Fix `renderIssueListScreen`** (lines 112-136):

Change the parameter name from `_width` to `width` and replace all `lines.push(...)` calls with an `add()` helper that truncates:

```ts
export function renderIssueListScreen(
  rows: IssueListRow[],
  cursor: number,
  width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));

  add(theme.fg("accent", "Issue list"));
  add("");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind === "milestone") {
      add(theme.bold(row.label));
      continue;
    }
    const prefix = i === cursor ? "> " : "  ";
    add(`${prefix}${row.label}`);
  }

  add("");
  add("↑↓ navigate • Tab next • Enter select • Esc cancel");
  return lines;
}
```

3. **Fix `renderIssueDetailScreen`** (lines 174-192):

Change `_width` to `width` and replace all `lines.push(...)` with `add()`:

```ts
export function renderIssueDetailScreen(
  issue: Issue,
  width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));

  add(theme.bold(`#${String(issue.id).padStart(3, "0")} ${issue.title}`));
  add(`${issue.type} • ${issue.status} • milestone ${issue.milestone || "none"}`);
  add("");
  for (const line of issue.description.split("\n")) {
    add(line);
  }
  add("");
  add(theme.fg("accent", "Back"));
  add(theme.fg("dim", "Esc or Backspace to return to the list"));
  return lines;
}
```

4. **Fix `renderIssueActionMenuScreen`** (lines 203-223):

Change `_width` to `width` and replace all `lines.push(...)` with `add()`:

```ts
export function renderIssueActionMenuScreen(
  issue: Issue,
  items: IssueActionItem[],
  actionIndex: number,
  width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));

  add(theme.fg("accent", "Issue actions"));
  add(theme.bold(`#${String(issue.id).padStart(3, "0")} ${issue.title}`));
  add("");
  for (let i = 0; i < items.length; i++) {
    const prefix = i === actionIndex ? "> " : "  ";
    add(`${prefix}${items[i].label}`);
  }
  add("");
  add("↑↓ navigate • Enter select • Esc back");
  return lines;
}
```

The pattern follows the working `ui-checklist.ts` convention: define a local `add()` helper wrapping `truncateToWidth(line, width)` and route every emitted line through it. Empty strings are passed through unchanged to preserve blank-line spacing.

**Step 4 — Run test, verify it passes**

Run: `bun test ./tests/ui-issue-list-width.test.ts`

Expected: PASS — 1 test, 24 expect() calls (8 lines × 3 screens checked against width bound)

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing — existing issue-list tests in `tests/ui-issue-list-navigation.test.ts`, `tests/ui-issue-list-detail.test.ts`, `tests/ui-issue-list-rows.test.ts`, and `tests/ui-issue-list-actions.test.ts` continue to pass because truncation only removes overflow characters; content assertions on short test data are unaffected.
