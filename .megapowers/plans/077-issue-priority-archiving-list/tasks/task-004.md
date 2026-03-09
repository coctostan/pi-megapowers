---
id: 4
title: Add pure active-issue sorting grouping and triage filtering helpers
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-list.test.ts
---

### Task 4: Add pure active-issue sorting grouping and triage filtering helpers [depends: 1]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-list.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect } from "bun:test";
import {
  sortActiveIssues,
  buildMilestoneIssueSections,
  formatActiveIssueListItem,
  filterTriageableIssues,
} from "../extensions/megapowers/ui.js";
import type { Issue } from "../extensions/megapowers/state/store.js";

const issue = (
  id: number,
  title: string,
  milestone: string | undefined,
  priority: number | undefined,
  createdAt: number,
  status: Issue["status"] = "open",
): Issue => ({
  id,
  slug: `${String(id).padStart(3, "0")}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  title,
  type: "feature",
  status,
  description: `${title} description`,
  createdAt,
  sources: [],
  milestone,
  priority,
});

describe("active issue list helpers (AC4-AC13)", () => {
  const issues = [
    issue(4, "Later M2", "M2", 2, 400),
    issue(2, "Earlier M1", "M1", 2, 200),
    issue(1, "Top M1", "M1", 1, 300),
    issue(3, "No priority M1 old", "M1", undefined, 100),
    issue(5, "Archived", "M1", 1, 50, "archived"),
  ];

  it("sortActiveIssues orders by milestone, then priority, then createdAt (AC4-AC6)", () => {
    const sorted = sortActiveIssues(issues.filter(i => i.status !== "archived"));
    expect(sorted.map(i => i.id)).toEqual([1, 2, 3, 4]);
  });

  it("buildMilestoneIssueSections groups sorted issues by milestone (AC7)", () => {
    const sorted = sortActiveIssues(issues.filter(i => i.status !== "archived"));
    const sections = buildMilestoneIssueSections(sorted);
    expect(sections[0].milestone).toBe("M1");
    expect(sections[0].issues.map(i => i.id)).toEqual([1, 2, 3]);
    expect(sections[1].milestone).toBe("M2");
    expect(sections[1].issues.map(i => i.id)).toEqual([4]);
  });

  it("formatActiveIssueListItem includes id, title, status, and priority (AC8-AC11)", () => {
    const sorted = sortActiveIssues(issues.filter(i => i.status !== "archived"));
    const item = formatActiveIssueListItem(sorted[0]);
    expect(item).toContain("#001");
    expect(item).toContain("Top M1");
    expect(item).toContain("[open]");
    expect(item).toContain("[P1]");
  });

  it("filterTriageableIssues excludes archived, done, and batch issues (AC13)", () => {
    const withBatch = [
      ...issues,
      issue(6, "Done", "M1", 1, 600, "done"),
      { ...issue(7, "Batch child", "M1", 1, 700), sources: [1, 2] },
    ];
    const triageable = filterTriageableIssues(withBatch);
    expect(triageable.map(i => i.id)).toEqual([4, 2, 1, 3]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-list.test.ts`
Expected: FAIL — `SyntaxError: Export named 'sortActiveIssues' not found in module '../extensions/megapowers/ui.js'`

**Step 3 — Write minimal implementation**
```ts
// Add to extensions/megapowers/ui.ts — new exports after existing filterTriageableIssues
export interface MilestoneIssueSection {
  milestone: string;
  issues: Issue[];
}
function milestoneRank(milestone?: string): number {
  if (!milestone) return Number.MAX_SAFE_INTEGER;
  const match = milestone.match(/^M(\d+)$/i);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}
export function sortActiveIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const milestoneCmp = milestoneRank(a.milestone) - milestoneRank(b.milestone);
    if (milestoneCmp !== 0) return milestoneCmp;
    const aPriority = typeof a.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
    const bPriority = typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.createdAt - b.createdAt;
  });
}
export function buildMilestoneIssueSections(issues: Issue[]): MilestoneIssueSection[] {
  const sections: MilestoneIssueSection[] = [];
  for (const issue of issues) {
    const milestone = issue.milestone || "none";
    const existing = sections.find(section => section.milestone === milestone);
    if (existing) {
      existing.issues.push(issue);
    } else {
      sections.push({ milestone, issues: [issue] });
    }
  }
  return sections;
}
export function formatActiveIssueListItem(issue: Issue, batchSlug?: string | null): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  const priority = typeof issue.priority === "number" ? ` [P${issue.priority}]` : "";
  const batchAnnotation = batchSlug ? ` (in batch ${batchSlug})` : "";
  return `${id}${priority} ${issue.title} [${issue.status}]${batchAnnotation}`;
}
// Update existing filterTriageableIssues to also exclude archived:
export function filterTriageableIssues(issues: Issue[]): Issue[] {
  return issues.filter(i => i.status !== "done" && i.status !== "archived" && i.sources.length === 0);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-list.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
