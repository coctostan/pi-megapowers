---
id: 3
title: Inline tool hints for revise/implement prompts
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - prompts/revise-plan.md
  - prompts/implement-task.md
  - tests/phase-tool-guidance.test.ts
files_to_create: []
---

**Covers:** AC 5, AC 6, AC 12, AC 14, AC 15.

**Files:**
- Modify: `prompts/revise-plan.md`
- Modify: `prompts/implement-task.md`
- Modify: `tests/phase-tool-guidance.test.ts`

**Step 1 — Write the failing test**
Append this block to `tests/phase-tool-guidance.test.ts`:

```ts
describe("phase-specific tool guidance — revise-plan/implement-task", () => {
  it("revise-plan.md adds symbol, read, ast_search, grep, and impact revision hints", () => {
    const content = readPrompt("revise-plan.md");
    expectAll(content, [
      "Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.",
      "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into the task's test/implementation text.",
      "Use `ast_search` to confirm structural patterns used in Step 3 actually exist in the codebase.",
      "When the reviewer said 'missing coverage for AC N', use `grep` for the AC identifier across `spec.md` and the task files to confirm which task you added now covers it — don't just append a task and assume.",
      "When a revision changes a function signature in Step 3, run `impact` with `changeType: \"signature_change\"` on that symbol and update the task's **Files** list to include every dependent the impact call surfaces.",
      "**Coverage re-check:** if the revision addressed a missing-AC complaint, use `grep` across spec and task files to confirm the AC is now referenced.",
    ]);
  });

  it("implement-task.md adds signature, anchor, impact, and drift-recovery hints", () => {
    const content = readPrompt("implement-task.md");
    expectAll(content, [
      "When the plan's test references an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to confirm its real signature before pasting the test.",
      "Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.",
      "Before patching, run `impact` on the changed symbol to see the full dependent set, so you fix all downstream tests in one pass rather than cascading.",
      "| Implementation doesn't match what the file looks like now | Run `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` — the plan was based on an earlier snapshot; start from reality. |",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the new `revise-plan.md` / `implement-task.md` guidance strings.

**Step 3 — Write minimal implementation**
In `prompts/revise-plan.md`, insert these three bullets between instruction items 3 and 4:

```md
- Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.
- Use `read` with `symbol: "<name>"` to pull the exact current signature into the task's test/implementation text.
- Use `ast_search` to confirm structural patterns used in Step 3 actually exist in the codebase.
```

Add these bullets to `## Most Common Revision Failures` near the matching rows:

```md
- When the reviewer said 'missing coverage for AC N', use `grep` for the AC identifier across `spec.md` and the task files to confirm which task you added now covers it — don't just append a task and assume.
- When a revision changes a function signature in Step 3, run `impact` with `changeType: "signature_change"` on that symbol and update the task's **Files** list to include every dependent the impact call surfaces.
```

Add this item to `## Pre-Submit Checklist`:

```md
- [ ] **Coverage re-check:** if the revision addressed a missing-AC complaint, use `grep` across spec and task files to confirm the AC is now referenced.
```

In `prompts/implement-task.md`, insert these inline hints:

```md
#### RED — Write one failing test
1. Write the test from the plan (Step 1 of the task)
   When the plan's test references an existing symbol, use `read` with `symbol: "<name>"` or `symbol_graph` with `include: ["source"]` to confirm its real signature before pasting the test.
...
#### GREEN — Write minimal code to pass
1. Write the implementation from the plan (Step 3 of the task) — just enough to make the test pass, nothing more
   Before editing, use `read` with `symbol: "<name>"` (or `symbol_graph` with `include: ["source"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.
...
5. If other tests break, fix them now before moving on
   Before patching, run `impact` on the changed symbol to see the full dependent set, so you fix all downstream tests in one pass rather than cascading.
```

Add this row to `## When Stuck`:

```md
| Implementation doesn't match what the file looks like now | Run `read` with `symbol: "<name>"` or `symbol_graph` with `include: ["source"]` — the plan was based on an earlier snapshot; start from reality. |
```

Keep the new guidance as short inline sentences; do not turn the sections into multi-paragraph tool docs.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
