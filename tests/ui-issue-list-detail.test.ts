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
