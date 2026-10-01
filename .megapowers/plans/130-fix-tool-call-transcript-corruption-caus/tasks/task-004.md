---
id: 4
title: Describe session-preserving transitions
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/register-tools.test.ts
files_to_create: []
---

### Task 4: Describe session-preserving transitions [depends: 1]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `tests/register-tools.test.ts`

Covers Fixed When 7's model-facing policy. Registration still has the verified signature `registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void`; this task changes descriptions, not schemas, tool names, state handlers, or execution semantics.

**Step 1 — Write the failing test**
Append this complete block to `tests/register-tools.test.ts`, whose existing imports already supply all four symbols it uses.

```ts
describe("tool session descriptions", () => {
  it("transition tools describe preservation rather than automatic fresh sessions", () => {
    const tools: Record<string, any> = {};
    registerTools({ registerTool: (tool: any) => { tools[tool.name] = tool; } } as any, {});
    for (const name of ["megapowers_signal", "megapowers_plan_review"]) {
      expect(tools[name].description).toContain("preserves the current Pi session");
      expect(tools[name].description).not.toMatch(/starts a new session|fresh session/i);
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts -t "tool session descriptions"`
Expected: FAIL. An actual registerTools probe emitted:
```text
error: expect(received).toContain(expected)

Expected to contain: "preserves the current Pi session"
```
The received current signal description includes `plan_draft_done ... starts a new session`. Task 1 does not modify descriptions, so this remains RED after its repair.

**Step 3 — Write minimal implementation**
Replace ONLY the signal tool's description property with:
```ts
description: "Signal a megapowers state transition. Every action preserves the current Pi session. Actions: task_done (mark current implement task complete), plan_draft_done (signal draft is complete — transitions planMode from draft/revise to review), phase_next (advance to the next workflow phase), phase_back (go back one phase — e.g. verify→implement, code-review→implement; errors if no backward transition exists), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run), close_issue (mark issue as done, reset workflow state — done phase only).",
```
Replace ONLY the review tool's description property with:
```ts
description: "Submit plan review verdict. Approves the plan or requests revisions with per-task feedback. This preserves the current Pi session.",
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts -t "tool session descriptions"`
Expected: PASS.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing; existing registration/schema tests remain intact.
