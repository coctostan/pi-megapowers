import type { Issue } from "./state/store.js";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

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

export type NavigationKey = "up" | "down" | "tab";

export function findFirstFocusableRow(rows: IssueListRow[]): number {
  const index = rows.findIndex((row) => row.focusable);
  return index >= 0 ? index : 0;
}

export function moveIssueListCursor(rows: IssueListRow[], cursor: number, key: NavigationKey): number {
  if (rows.length === 0) return 0;
  const delta = key === "up" ? -1 : 1;
  let next = cursor;

  while (true) {
    const candidate = next + delta;
    if (candidate < 0 || candidate >= rows.length) {
      return next;
    }
    next = candidate;
    if (rows[next]?.focusable) {
      return next;
    }
  }
}

export function renderIssueListScreen(
  rows: IssueListRow[],
  cursor: number,
  width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));

  add(theme.fg("accent", "Issue list"));
  add("");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind === "milestone") {
      add(theme.bold(row.label));
      continue;
    }
    const prefix = i === cursor ? "> " : "  ";
    add(`${prefix}${row.label}`);
  }

  add("");
  add("↑↓ navigate • Tab next • Enter select • Esc cancel");
  return lines;
}

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

export type IssueListViewState =
  | { screen: "list"; cursor: number }
  | { screen: "detail"; issue: Issue; returnCursor: number };

export function openIssueDetailView(issue: Issue, returnCursor: number): Extract<IssueListViewState, { screen: "detail" }> {
  return { screen: "detail", issue, returnCursor };
}

export function returnToListView(view: Extract<IssueListViewState, { screen: "detail" }>): IssueListViewState {
  return { screen: "list", cursor: view.returnCursor };
}

export function renderIssueDetailScreen(
  issue: Issue,
  width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));

  add(theme.bold(`#${String(issue.id).padStart(3, "0")} ${issue.title}`));
  add(`${issue.type} • ${issue.status} • milestone ${issue.milestone || "none"}`);
  add("");
  for (const line of issue.description.split("\n")) {
    add(line);
  }
  add("");
  add(theme.fg("accent", "Back"));
  add(theme.fg("dim", "Esc or Backspace to return to the list"));
  return lines;
}

export type IssueListResult =
  | null
  | { type: "create" }
  | { type: "issue-action"; action: IssueActionKey; issue: Issue };

type WidgetView =
  | IssueListViewState
  | { screen: "menu"; rowIndex: number; actionIndex: number };

export function renderIssueActionMenuScreen(
  issue: Issue,
  items: IssueActionItem[],
  actionIndex: number,
  width: number,
  theme: { fg(color: string, text: string): string; bold(text: string): string },
): string[] {
  const lines: string[] = [];
  const add = (line: string = "") => lines.push(line === "" ? "" : truncateToWidth(line, width));

  add(theme.fg("accent", "Issue actions"));
  add(theme.bold(`#${String(issue.id).padStart(3, "0")} ${issue.title}`));
  add("");
  for (let i = 0; i < items.length; i++) {
    const prefix = i === actionIndex ? "> " : "  ";
    add(`${prefix}${items[i].label}`);
  }
  add("");
  add("↑↓ navigate • Enter select • Esc back");
  return lines;
}

export async function showIssueListUI(
  ctx: { hasUI: boolean; ui: { custom: <T>(fn: any) => Promise<T> } },
  rows: IssueListRow[],
  activeIssueSlug: string | null,
): Promise<IssueListResult> {
  if (!ctx.hasUI) return null;

  return ctx.ui.custom<IssueListResult>((tui: any, theme: any, _kb: any, done: (value: IssueListResult) => void) => {
    let view: WidgetView = { screen: "list", cursor: findFirstFocusableRow(rows) };

    function refresh() {
      tui.requestRender();
    }

    function getMenuItems(menuView: Extract<WidgetView, { screen: "menu" }>): IssueActionItem[] {
      const row = rows[menuView.rowIndex];
      return row?.kind === "issue" ? buildIssueActionItems(row.issue, activeIssueSlug) : [];
    }

    return {
      render: (width: number) => {
        if (view.screen === "detail") {
          return renderIssueDetailScreen(view.issue, width, theme);
        }
        if (view.screen === "menu") {
          const row = rows[view.rowIndex];
          const items = getMenuItems(view);
          return row?.kind === "issue"
            ? renderIssueActionMenuScreen(row.issue, items, view.actionIndex, width, theme)
            : renderIssueListScreen(rows, findFirstFocusableRow(rows), width, theme);
        }
        return renderIssueListScreen(rows, view.cursor, width, theme);
      },
      invalidate: () => {},
      handleInput: (data: string) => {
        if (view.screen === "detail") {
          if (matchesKey(data, Key.escape) || matchesKey(data, Key.backspace)) {
            view = returnToListView(view);
            refresh();
          }
          return;
        }

        if (view.screen === "menu") {
          const items = getMenuItems(view);
          if (matchesKey(data, Key.up)) {
            view = { ...view, actionIndex: Math.max(0, view.actionIndex - 1) };
            refresh();
            return;
          }
          if (matchesKey(data, Key.down) || matchesKey(data, Key.tab)) {
            view = { ...view, actionIndex: Math.min(items.length - 1, view.actionIndex + 1) };
            refresh();
            return;
          }
          if (matchesKey(data, Key.escape)) {
            view = { screen: "list", cursor: view.rowIndex };
            refresh();
            return;
          }
          if (matchesKey(data, Key.enter)) {
            const row = rows[view.rowIndex];
            const selected = items[view.actionIndex];
            if (row?.kind !== "issue" || !selected) return;
            if (selected.key === "view") {
              view = openIssueDetailView(row.issue, view.rowIndex);
              refresh();
              return;
            }
            done({ type: "issue-action", action: selected.key, issue: row.issue });
          }
          return;
        }

        if (matchesKey(data, Key.up)) {
          view = { screen: "list", cursor: moveIssueListCursor(rows, view.cursor, "up") };
          refresh();
          return;
        }
        if (matchesKey(data, Key.down) || matchesKey(data, Key.tab)) {
          view = { screen: "list", cursor: moveIssueListCursor(rows, view.cursor, "down") };
          refresh();
          return;
        }
        if (matchesKey(data, Key.escape)) {
          done(null);
          return;
        }
        if (matchesKey(data, Key.enter)) {
          const row = rows[view.cursor];
          if (row?.kind === "create") {
            done({ type: "create" });
            return;
          }
          if (row?.kind === "issue") {
            view = { screen: "menu", rowIndex: view.cursor, actionIndex: 0 };
            refresh();
          }
        }
      },
    };
  });
}
