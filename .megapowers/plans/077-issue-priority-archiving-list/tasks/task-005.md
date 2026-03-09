---
id: 5
title: Use grouped active issues in issue list and add archived view subcommand
status: approved
depends_on:
  - 1
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-command-list.test.ts
---

### Task 5: Use grouped active issues in issue list and add archived view subcommand [depends: 1, 4]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-list.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createUI } from "../extensions/megapowers/ui.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-command-list-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function createMockCtx(selectReturn?: string) {
  const notifications: string[] = [];
  const selects: string[][] = [];
  return {
    hasUI: true,
    cwd: tmp,
    ui: {
      theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
      select: async (_prompt: string, items: string[]) => {
        selects.push(items);
        return selectReturn ?? null;
      },
      input: async () => null,
      editor: async () => null,
      notify: (msg: string) => notifications.push(msg),
      setWidget: () => {},
      setStatus: () => {},
    },
    _notifications: notifications,
    _selects: selects,
  };
}

describe("issue command list and archived view (AC7-AC12, AC28, AC30)", () => {
  it("shows grouped active issues in default list and archived issues only in archived view", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const state = createInitialState();

    store.createIssue("M2 item", "feature", "desc", undefined, "M2", 2);
    const m1 = store.createIssue("M1 top", "feature", "desc", undefined, "M1", 1);

    const archiveDir = join(tmp, ".megapowers", "issues", "archive");
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(
      join(archiveDir, "099-archived-item.md"),
      `---\nid: 99\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\narchived: 2026-03-02T00:00:00.000Z\n---\n# Archived item\narchived desc\n`,
    );

    const listCtx = createMockCtx(`#${String(m1.id).padStart(3, "0")} [P1] M1 top [open]`);
    await ui.handleIssueCommand(listCtx as any, state, store, "list");

    const renderedItems = listCtx._selects[0].join("\n");
    expect(renderedItems).toContain("M1:");
    expect(renderedItems).toContain("M2:");
    expect(renderedItems).toContain("#002 [P1] M1 top [open]");
    expect(renderedItems).not.toContain("Archived item");

    const archivedCtx = createMockCtx();
    await ui.handleIssueCommand(archivedCtx as any, state, store, "archived");
    expect(archivedCtx._notifications.join("\n")).toContain("Archived item");
    expect(archivedCtx._notifications.join("\n")).not.toContain("M1 top");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-list.test.ts`
Expected: FAIL — `expect(received).toContain(expected) // Expected substring: "M1:"`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/ui.ts — add two new exported helpers near other helpers
export function formatMilestoneHeader(milestone: string, issues: Issue[]): string {
  return `${milestone}: (${issues.length} issue${issues.length === 1 ? "" : "s"})`;
}
export function formatArchivedIssueList(issues: Issue[]): string {
  return issues.map(i => formatActiveIssueListItem(i)).join("\n");
}
```

```ts
// extensions/megapowers/ui.ts — inside createUI().handleIssueCommand()
// INSERT this block AFTER the `if (subcommand === "new" || subcommand === "create")` block
// and BEFORE the existing `if (subcommand === "list")` block:
if (subcommand === "archived") {
        const archivedIssues = sortActiveIssues(store.listArchivedIssues());
        if (archivedIssues.length === 0) {
          ctx.ui.notify("No archived issues.", "info");
          return state;
        }
        ctx.ui.notify(`Archived issues:\n${formatArchivedIssueList(archivedIssues)}`, "info");
        return state;
      }
```

```ts
// extensions/megapowers/ui.ts — REPLACE the existing `if (subcommand === "list")` block
// with this updated version that uses milestone grouping and robust header guard:
if (subcommand === "list") {
        const issues = sortActiveIssues(store.listIssues().filter(i => i.status !== "done"));
        if (issues.length === 0) {
          ctx.ui.notify("No open issues. Use /issue new to create one.", "info");
          return state;
        }
  const sections = buildMilestoneIssueSections(issues);
        const items = sections.flatMap(section => [
          formatMilestoneHeader(section.milestone, section.issues),
          ...section.issues.map(i => formatActiveIssueListItem(i, store.getBatchForIssue(i.id))),
        ]);
  items.push("+ Create new issue...");
        const choice = await ctx.ui.select("Pick an issue:", items);
        if (!choice) return state;
  if (choice.startsWith("+")) return this.handleIssueCommand(ctx, state, store, "new");
        const idMatch = choice.match(/^#(\d+)/);
        if (!idMatch) return state;
        const selected = issues.find((i) => i.id === parseInt(idMatch[1]));
  if (!selected) return state;
        const firstPhase = getFirstPhase(selected.type);
        const newState: MegapowersState = {
          ...state,
          activeIssue: selected.slug,
          workflow: selected.type,
          phase: firstPhase,
          phaseHistory: [],
          reviewApproved: false,
          currentTaskIndex: 0,
          completedTasks: [],
          tddTaskState: null,
          doneActions: [],
        };
  writeState(ctx.cwd, newState);
        store.updateIssueStatus(selected.slug, "in-progress");
        ctx.ui.notify(`Activated: ${selected.slug}`, "info");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }
      // unknown-subcommand branch stays at the end
      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: new, list, archived`, "error");
      return state;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-list.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
