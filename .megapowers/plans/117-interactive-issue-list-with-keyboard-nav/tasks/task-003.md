---
id: 3
title: Define per-issue action menus for active and non-active rows
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/ui-issue-list.ts
files_to_create:
  - tests/ui-issue-list-actions.test.ts
---

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
