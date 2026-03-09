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
