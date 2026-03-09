---
id: 4
title: Add in-widget detail view rendering and return state
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/ui-issue-list.ts
files_to_create:
  - tests/ui-issue-list-detail.test.ts
---

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
