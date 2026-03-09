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
