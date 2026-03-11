---
id: 4
title: Remove legacy delegation wording from implement prompts
status: approved
depends_on:
  - 1
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/prompts.ts
  - prompts/implement-task.md
  - tests/prompts.test.ts
files_to_create: []
---

### Task 4: Remove legacy delegation wording from implement prompts [depends: 1, 3]

**Files:**
- Modify: `extensions/megapowers/prompts.ts`
- Modify: `prompts/implement-task.md`
- Test: `tests/prompts.test.ts`

**Step 1 — Write the failing test**
In `tests/prompts.test.ts`, replace the `describe("implement prompt — subagent delegation instructions", ...)` block with:

```ts
describe("implement prompt — direct primary-session execution", () => {
  it("implement-task template explicitly prohibits legacy pipeline/subagent tools", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toMatch(/do not use.*pipeline|do not use.*subagent/i);
  });

  it("implement-task template specifies inline execution mode", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toMatch(/work directly|inline|this session/i);
  });

  it("buildImplementTaskVars does not advertise delegation to subagents", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Set up shared types", completed: true, noTest: false },
      { index: 2, description: "Build auth module", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Build logging module", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars).toHaveProperty("remaining_tasks");
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).not.toContain("delegated to subagent");
    expect(vars.remaining_tasks).toContain("ready — can be implemented now");
  });

  it("remaining_tasks still marks tasks with unmet dependencies", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: false, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.remaining_tasks).toContain("Task 2");
    expect(vars.remaining_tasks).toContain("blocked — waiting on task(s) 1");
  });

  it("remaining_tasks is sentinel when no tasks remain after current", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Only task", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.remaining_tasks).toBe("None — this is the only remaining task.");
  });

  it("remaining_tasks shows tasks as ready when their dependencies are complete", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: true, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false, dependsOn: [1] },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).not.toMatch(/Task 3.*blocked/i);
  });

  it("implement-task template instructs tests_failed signal after RED test failure", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_failed" })');
  });

  it("implement-task template instructs tests_passed signal after GREEN test pass", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_passed" })');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompts.test.ts`
Expected: FAIL — the `buildImplementTaskVars` assertion fails because `extensions/megapowers/prompts.ts` still says `ready — can be delegated to subagent`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/prompts.ts`, replace the ready-task wording in `buildRemainingTasksSummary()` with:

```ts
      if (unmetDeps.length > 0) {
        return `○ Task ${t.index}: ${t.description} [blocked — waiting on task(s) ${unmetDeps.join(", ")}]`;
      }
      return `○ Task ${t.index}: ${t.description} [ready — can be implemented now]`;
```

In `prompts/implement-task.md`, keep the direct-session guidance and legacy-tool prohibition as the implementation contract:

```md
## Execution Mode
Work directly in this session. TDD is enforced via tdd-guard.
**Do NOT use `pipeline` or `subagent` tools for implementation work in this session.** Do all implementation work inline here.

This restriction is specific to implement-phase task execution. Advisory planning-scout usage in the plan phase is separate.
```

Do not add any replacement delegation workflow.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompts.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
