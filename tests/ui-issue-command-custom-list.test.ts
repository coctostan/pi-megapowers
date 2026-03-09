import { describe, expect, it } from "bun:test";
import type { Issue } from "../extensions/megapowers/state/store.js";
import { buildIssueListRows, showIssueListUI } from "../extensions/megapowers/ui-issue-list.js";

const ESC = "\u001b";
const ENTER = "\r";
const DOWN = "\u001b[B";
const BACKSPACE = "\u007f";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function issue(id: number, slug: string, title: string, status: Issue["status"]): Issue {
  return {
    id,
    slug,
    title,
    type: "feature",
    status,
    description: `${title} full description`,
    createdAt: id,
    sources: [],
    milestone: "M1",
    priority: id,
  };
}

async function driveWidget(
  rows: ReturnType<typeof buildIssueListRows>,
  activeIssueSlug: string | null,
  inputs: string[],
) {
  const renders: string[] = [];
  let result: Awaited<ReturnType<typeof showIssueListUI>> | undefined;

  const ctx = {
    hasUI: true,
    ui: {
      custom: async <T>(factory: any): Promise<T> => {
        const tui = {
          requestRender() {
            renders.push(widget.render(80).join("\n"));
          },
        };
        const done = (value: T) => {
          result = value;
        };
        const widget = factory(tui, theme, null, done);
        renders.push(widget.render(80).join("\n"));
        for (const input of inputs) {
          widget.handleInput(input);
          renders.push(widget.render(80).join("\n"));
          if (result !== undefined) break;
        }
        return result as T;
      },
    },
  };

  result = await showIssueListUI(ctx as any, rows, activeIssueSlug);
  return { result, renders };
}

describe("showIssueListUI", () => {
  it("renders list view, opens action menu, supports detail view return, and dismisses with Escape", async () => {
    const active = issue(2, "002-active", "Active issue", "in-progress");
    const other = issue(1, "001-other", "Other issue", "open");
    const rows = buildIssueListRows([other, active], active.slug, () => null);

    const dismissed = await driveWidget(rows, active.slug, [ESC]);
    expect(dismissed.result).toBeNull();

    const menuEscape = await driveWidget(rows, active.slug, [ENTER, ESC, ESC]);
    expect(menuEscape.result).toBeNull();
    expect(menuEscape.renders.some((screen) => screen.includes("Issue list"))).toBe(true);
    expect(menuEscape.renders.some((screen) => screen.includes("Open/Activate"))).toBe(true);

    const detail = await driveWidget(rows, active.slug, [ENTER, DOWN, DOWN, ENTER, BACKSPACE, ESC]);
    expect(detail.result).toBeNull();
    expect(detail.renders.some((screen) => screen.includes("Other issue full description"))).toBe(true);
    expect(detail.renders.some((screen) => screen.includes("Issue list"))).toBe(true);
  });
});
