---
id: 8
title: Signal tool handler calls newSession for all transition actions
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: false
files_to_modify:
  - tests/new-session-wiring.test.ts
files_to_create: []
---

### Task 8: Signal tool handler calls newSession for all transition actions [depends: 1, 2, 3, 4]

This task verifies AC10: the signal tool handler in `register-tools.ts` calls `newSession` when `triggerNewSession` is set. The existing wiring already checks `result.triggerNewSession` and calls `(ctx.sessionManager as any)?.newSession?.(...)` — no change is needed in register-tools.ts for the signal handler. Tasks 1-4 added `triggerNewSession: true` to the return values, so the existing wiring now triggers `newSession` for all transition actions.

This task adds integration tests verifying that `newSession` is actually called for `phase_next` and `task_done` via the registered tool's `execute` function, complementing the existing `plan_draft_done` test.

**Files:**
- Test: `tests/new-session-wiring.test.ts`

**Step 1 — Write the failing test**

In `tests/new-session-wiring.test.ts`, add the following tests after the existing `describe("newSession wiring", ...)` tests:

```ts
  it("megapowers_signal(phase_next) starts a new session on successful transition", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-phase-next-"));
    try {
      setState(tmp, { phase: "brainstorm" });

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_signal.execute("1", { action: "phase_next" }, undefined, undefined, ctx);

      expect(sessionManager.newSessionCalls).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("megapowers_signal(task_done) starts a new session when advancing to next task", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-task-done-"));
    try {
      setState(tmp, { phase: "implement", currentTaskIndex: 0, completedTasks: [] ,
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false } });
      const planDir = join(tmp, ".megapowers", "plans", "001-test");
      mkdirSync(planDir, { recursive: true });
      writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_signal.execute("1", { action: "task_done" }, undefined, undefined, ctx);

      expect(sessionManager.newSessionCalls).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("megapowers_signal does NOT call newSession on error", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-error-"));
    try {
      setState(tmp, { phase: "spec" }); // spec.md missing — gate will fail

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_signal.execute("1", { action: "phase_next" }, undefined, undefined, ctx);

      expect(sessionManager.newSessionCalls).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/new-session-wiring.test.ts -t "megapowers_signal(phase_next) starts a new session"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: 1, Received: 0` (until Tasks 1-4 are implemented, `handlePhaseNext` doesn't return `triggerNewSession: true`)

Note: If Tasks 1-4 are already implemented, this test should pass immediately. The FAIL state depends on execution order.

**Step 3 — Write minimal implementation**

No changes to `register-tools.ts` needed — the existing `if (result.triggerNewSession)` wiring already handles calling `newSession`. Tasks 1-4 provide the `triggerNewSession: true` values.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/new-session-wiring.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
