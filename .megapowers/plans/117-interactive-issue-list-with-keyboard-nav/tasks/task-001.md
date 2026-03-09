---
id: 1
title: Build grouped issue-list rows for the custom widget
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/ui-issue-list.ts
  - tests/ui-issue-list-rows.test.ts
---

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
