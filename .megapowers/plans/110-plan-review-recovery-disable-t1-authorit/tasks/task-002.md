---
id: 2
title: Remove T1 gating from handlePlanDraftDone
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 2: Remove T1 gating from handlePlanDraftDone [depends: 1]

Covers Fixed When: 2

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

`tests/tool-signal.test.ts` already exists and already contains `describe("plan_draft_done signal", ...)`, `describe("handlePlanDraftDone — async T1 lint integration", ...)`, and `describe("handlePlanDraftDone — graceful degradation", ...)`. This task updates that existing coverage to match the restored simple-transition contract.

**Step 1 — Write the failing test**
In the existing `tests/tool-signal.test.ts` file, keep the current `describe("plan_draft_done signal", ...)` block and replace the current T1-specific coverage at the bottom of the file with this regression test:

```ts
it("ignores failing model lint input and still transitions to review", async () => {
  const tmp2 = mkdtempSync(join(tmpdir(), "tool-signal-plan-draft-done-no-t1-"));

  try {
    writeState(tmp2, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
    });

    const tasksDir = join(tmp2, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, "task-001.md"),
      "---\nid: 1\ntitle: Task 1\nstatus: draft\ndepends_on: []\nno_test: false\nfiles_to_modify: [src/foo.ts]\nfiles_to_create: []\n---\n" + "A".repeat(220),
    );
    writeFileSync(
      join(tmp2, ".megapowers", "plans", "001-test", "spec.md"),
      "## Acceptance Criteria\n1. AC1",
    );

    const failFn = async () => JSON.stringify({
      verdict: "fail",
      findings: ["AC1 is not covered by any task"],
    });

    const result = await (handlePlanDraftDone as any)(tmp2, failFn);

    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(result.message).toContain("Transitioning to review mode");
    expect(result.message).not.toContain("T1");
    expect(readState(tmp2).planMode).toBe("review");
  } finally {
    rmSync(tmp2, { recursive: true, force: true });
  }
});
```

Delete the existing `describe("handlePlanDraftDone — async T1 lint integration", ...)` block and the existing `describe("handlePlanDraftDone — graceful degradation", ...)` block, because those two blocks are the current buggy contract and already exist in the file today.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "ignores failing model lint input and still transitions to review"`
Expected: FAIL — `expect(received).toBeUndefined()` with `Received: "❌ T1 plan lint failed:\n  • AC1 is not covered by any task"`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-signal.ts`:

1. Remove the `deriveAcceptanceCriteria` import.
2. Remove the `lintPlanWithModel` / `CompleteFn` import.
3. Change the function signature back to a simple transition helper:

```ts
export async function handlePlanDraftDone(cwd: string): Promise<SignalResult> {
  const state = readState(cwd);
  if (state.phase !== "plan") {
    return { error: "plan_draft_done can only be called during the plan phase." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }

  const tasks = listPlanTasks(cwd, state.activeIssue!);
  if (tasks.length === 0) {
    return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
  }

  writeState(cwd, { ...state, planMode: "review" });
  return {
    message:
      `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n` +
      "  → Transitioning to review mode.",
    triggerNewSession: true,
  };
}
```

Do not leave any T1 warning strings, `criteriaText`, `taskSummaries`, or `lintResult` logic in the function.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "ignores failing model lint input and still transitions to review"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
