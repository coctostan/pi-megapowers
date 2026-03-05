# Plan

### Task 1: handleSignal returns triggerNewSession for phase_next

### Task 1: handleSignal returns triggerNewSession for phase_next

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("phase_next", ...)` block (after the existing tests, around line 338):

```ts
    it("returns triggerNewSession on successful phase advance", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful phase advance"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify `handlePhaseNext` (around line 249) to add `triggerNewSession: true` to the success return:

```ts
function handlePhaseNext(cwd: string, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: `Phase advanced to ${result.newPhase}. Proceed with ${result.newPhase} phase work.`,
    triggerNewSession: true,
  };
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful phase advance"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 2: handleSignal returns triggerNewSession for phase_back

### Task 2: handleSignal returns triggerNewSession for phase_back

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("phase_back", ...)` block (after the existing happy-path tests, around line 382):

```ts
    it("returns triggerNewSession on successful backward transition", () => {
      setState(tmp, { phase: "verify" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful backward transition"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify `handlePhaseBack` (around line 263) to add `triggerNewSession: true` to the success return:

Change the return at the end of `handlePhaseBack` from:
```ts
  return {
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with the ${result.newPhase} phase.`,
  };
```

To:
```ts
  return {
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with the ${result.newPhase} phase.`,
    triggerNewSession: true,
  };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful backward transition"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 3: handleSignal returns triggerNewSession for task_done advancing to next task

### Task 3: handleSignal returns triggerNewSession for task_done advancing to next task

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("task_done — core behavior", ...)` block (after existing tests, around line 200):

```ts
    it("returns triggerNewSession when advancing to next task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when advancing to next task"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify the `handleTaskDone` function. Find the return statement for the "advance to next task" case (around line 160):

Change from:
```ts
  return {
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} task${remaining === 1 ? "" : "s"} remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
  };
```

To:
```ts
  return {
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} task${remaining === 1 ? "" : "s"} remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
    triggerNewSession: true,
  };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when advancing to next task"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 4: handleSignal returns triggerNewSession for task_done auto-advancing to verify

### Task 4: handleSignal returns triggerNewSession for task_done auto-advancing to verify

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("task_done — core behavior", ...)` block (after existing tests):

```ts
    it("returns triggerNewSession when auto-advancing to verify (all tasks complete)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Only task\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("verify");
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when auto-advancing to verify"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify the `handleTaskDone` function. Find the return statement for the "all done, auto-advance to verify" case (around line 143):

Change from:
```ts
    return {
      message: `Task ${currentTask.index} (${currentTask.description}) marked complete. All ${tasks.length} tasks done! Phase advanced to verify. Begin verification.`,
    };
```

To:
```ts
    return {
      message: `Task ${currentTask.index} (${currentTask.description}) marked complete. All ${tasks.length} tasks done! Phase advanced to verify. Begin verification.`,
      triggerNewSession: true,
    };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when auto-advancing to verify"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 5: handleSignal does NOT return triggerNewSession on error results [depends: 1, 2, 3, 4]

### Task 5: handleSignal does NOT return triggerNewSession on error results [depends: 1, 2, 3, 4]

**Files:**
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add a new describe block after the existing `describe("invalid action", ...)` block:

```ts
  describe("triggerNewSession — error cases", () => {
    it("does NOT return triggerNewSession when phase_next fails", () => {
      setState(tmp, { phase: "spec" }); // spec.md missing — gate will fail
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when phase_back fails", () => {
      setState(tmp, { phase: "brainstorm" }); // no backward transition
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when task_done fails", () => {
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null, // Will fail TDD check
      });
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when plan_draft_done fails", () => {
      setState(tmp, { phase: "implement", planMode: null });
      const result = handleSignal(tmp, "plan_draft_done");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — error cases"`

Expected: PASS — These tests should already pass since error paths return `{ error: ... }` without `triggerNewSession`. This is a verification-only test confirming AC8.

Note: Since this is verifying existing correct behavior (error paths don't set triggerNewSession), these tests should pass immediately after Tasks 1-4 are implemented. They exist to guard against regressions.

**Step 3 — Write minimal implementation**

No implementation changes needed — error paths already return `{ error: ... }` without `triggerNewSession`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — error cases"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 6: handleSignal does NOT return triggerNewSession for non-transition actions [depends: 1, 2, 3, 4]

### Task 6: handleSignal does NOT return triggerNewSession for non-transition actions [depends: 1, 2, 3, 4]

**Files:**
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add a new describe block:

```ts
  describe("triggerNewSession — non-transition actions", () => {
    it("does NOT return triggerNewSession for tests_failed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession for tests_passed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "tests_passed");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession for close_issue", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "001-test.md"),
        "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Test\nDesc",
      );
      setState(tmp, { phase: "done" });
      const result = handleSignal(tmp, "close_issue");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — non-transition actions"`

Expected: PASS — These tests verify AC9 by confirming non-transition actions don't set `triggerNewSession`. They should pass immediately since `tests_failed`, `tests_passed`, and `close_issue` handlers don't set this flag.

**Step 3 — Write minimal implementation**

No implementation changes needed — non-transition handlers already return without `triggerNewSession`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — non-transition actions"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 7: handlePlanReview returns triggerNewSession for approve verdict

### Task 7: handlePlanReview returns triggerNewSession for approve verdict

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Test: `tests/tool-plan-review.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-plan-review.test.ts`, add the following test inside the `describe("handlePlanReview — approve verdict", ...)` block (after existing tests, around line 217):

```ts
  it("returns triggerNewSession on approve", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const result = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "All good.",
      approved_tasks: [1],
    });
    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts -t "returns triggerNewSession on approve"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-plan-review.ts`, modify `handleApproveVerdict` (around line 102) to add `triggerNewSession: true` to its return value.

Change from:
```ts
  return {
    message:
      `📋 Plan approved (iteration ${state.planIteration})\n` +
      `  ✅ All ${tasks.length} tasks approved\n` +
      "  → Generated plan.md for downstream consumers\n" +
      "  → Advancing to implement phase",
  };
```

To:
```ts
  return {
    message:
      `📋 Plan approved (iteration ${state.planIteration})\n` +
      `  ✅ All ${tasks.length} tasks approved\n` +
      "  → Generated plan.md for downstream consumers\n" +
      "  → Advancing to implement phase",
    triggerNewSession: true,
  };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-plan-review.test.ts -t "returns triggerNewSession on approve"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 8: Signal tool handler calls newSession for all transition actions [depends: 1, 2, 3, 4]

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

### Task 9: Simplify newSession call pattern in register-tools.ts [depends: 8]

### Task 9: Simplify newSession call pattern in register-tools.ts [depends: 8]

AC10 and AC11 require replacing the broken `(ctx.sessionManager as any)?.newSession?.(...)` call pattern with a cleaner approach. The `ExtensionContext` type (used in tool execute) does not expose `newSession` — that method lives on `ReadonlySessionManager` at runtime (as the full `SessionManager`). The improvement is to drop the unnecessary `parentSession` parameter (the new session inherits context via `buildInjectedPrompt`, not via session chaining), and simplify the cast.

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `tests/new-session-wiring.test.ts`

**Step 1 — Write the failing test**

In `tests/new-session-wiring.test.ts`, replace the existing test "uses a type-safe any-cast for sessionManager newSession access" (around line 101-105) with:

```ts
  it("calls newSession via sessionManager cast without parentSession arg", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
    // Should use the simplified cast pattern
    expect(source).toContain("(ctx.sessionManager as any)?.newSession?.()");
    // Should NOT use the old pattern with parentSession
    expect(source).not.toContain("parentSession");
    expect(source).not.toContain("getSessionFile");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/new-session-wiring.test.ts -t "calls newSession via sessionManager cast without parentSession arg"`

Expected: FAIL — `expect(string).not.toContain("parentSession")` fails because the current code includes `{ parentSession: parent ?? undefined }`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, modify both `newSession` call sites.

For the **signal tool handler** (around lines 44-47), change from:
```ts
      if (result.triggerNewSession) {
        const parent = ctx.sessionManager?.getSessionFile?.();
        (ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });
      }
```

To:
```ts
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
      }
```

For the **plan-review tool handler** (around lines 98-101), change from:
```ts
      if (result.triggerNewSession) {
        const parent = ctx.sessionManager?.getSessionFile?.();
        (ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });
      }
```

To:
```ts
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
      }
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/new-session-wiring.test.ts -t "calls newSession via sessionManager cast without parentSession arg"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
