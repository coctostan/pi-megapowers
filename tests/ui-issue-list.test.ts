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
