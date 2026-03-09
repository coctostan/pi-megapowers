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
