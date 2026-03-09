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
