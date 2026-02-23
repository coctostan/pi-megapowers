# Implementation Plan — 009: Implement phase subagent delegation

## Tasks

### Task 1: Add `dependsOn` to `PlanTask` interface [no-test]

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`

**Implementation:**

In `extensions/megapowers/state-machine.ts`, add the optional `dependsOn` field to the `PlanTask` interface:

```typescript
export interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
  noTest: boolean;
  dependsOn?: number[];
}
```

**Verify:** `bun test` — all existing tests pass since the field is optional.

---

### Task 2: Parse `[depends: N, M]` annotations in plan-parser

**Files:**
- Modify: `extensions/megapowers/plan-parser.ts`
- Test: `tests/plan-parser.test.ts`

**Test:** Add to `tests/plan-parser.test.ts`:

```typescript
it("extracts [depends: N, M] from task headers", () => {
  const plan = `### Task 1: Set up types

Details...

### Task 2: Build auth module [depends: 1]

Details...

### Task 3: Build logging module

Details...

### Task 4: Integration tests [depends: 2, 3]

Details...
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks).toHaveLength(4);
  expect(tasks[0].dependsOn).toBeUndefined();
  expect(tasks[1].dependsOn).toEqual([1]);
  expect(tasks[2].dependsOn).toBeUndefined();
  expect(tasks[3].dependsOn).toEqual([2, 3]);
});

it("extracts [depends: N] from numbered list items", () => {
  const plan = `1. Set up types
2. Build auth [depends: 1]
3. Build logging
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks[0].dependsOn).toBeUndefined();
  expect(tasks[1].dependsOn).toEqual([1]);
  expect(tasks[2].dependsOn).toBeUndefined();
});

it("parses [depends: ...] case-insensitively", () => {
  const plan = `### Task 1: Base types

### Task 2: Auth module [Depends: 1]
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks[1].dependsOn).toEqual([1]);
});

it("combines [no-test] and [depends: N] annotations", () => {
  const plan = `### Task 1: Config schema [no-test]

### Task 2: Logic [depends: 1]

### Task 3: Types [no-test] [depends: 1]
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks[0].noTest).toBe(true);
  expect(tasks[0].dependsOn).toBeUndefined();
  expect(tasks[1].noTest).toBe(false);
  expect(tasks[1].dependsOn).toEqual([1]);
  expect(tasks[2].noTest).toBe(true);
  expect(tasks[2].dependsOn).toEqual([1]);
});

it("existing plans without [depends:] parse identically (backward compat)", () => {
  const plan = `### Task 1: Database Schema

Details...

### Task 2: API Endpoint

Details...
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks).toHaveLength(2);
  expect(tasks[0]).toEqual({ index: 1, description: "Database Schema", completed: false, noTest: false });
  expect(tasks[1]).toEqual({ index: 2, description: "API Endpoint", completed: false, noTest: false });
});
```

**Implementation:**

In `extensions/megapowers/plan-parser.ts`, add a `parseDependsOn` helper and use it in both `extractTaskHeaders` and `extractNumberedItems`:

```typescript
/**
 * Parse [depends: N, M, ...] annotation from a raw task string.
 * Returns the array of dependency indices, or undefined if not present.
 */
function parseDependsOn(raw: string): number[] | undefined {
  const match = raw.match(/\[depends:\s*([\d,\s]+)\]/i);
  if (!match) return undefined;
  return match[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
}

/**
 * Strip [depends: ...] annotation from raw string.
 */
function stripDependsOn(raw: string): string {
  return raw.replace(/\s*\[depends:\s*[\d,\s]+\]\s*/gi, "");
}
```

Update `extractTaskHeaders`:
```typescript
function extractTaskHeaders(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const pattern = /^###\s+Task\s+(\d+):\s*(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    const raw = match[2].trim();
    const noTest = /\[no-test\]/i.test(raw);
    const dependsOn = parseDependsOn(raw);
    const description = stripDependsOn(raw.replace(/\s*\[no-test\]\s*/gi, "")).trim();
    const task: PlanTask = {
      index: parseInt(match[1]),
      description,
      completed: false,
      noTest,
    };
    if (dependsOn) task.dependsOn = dependsOn;
    tasks.push(task);
  }

  return tasks;
}
```

Apply the same pattern to `extractNumberedItems`:
```typescript
function extractNumberedItems(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s{0,1}(\d+)[.)]\s+(.+)/);
    if (match) {
      const raw = match[2].trim();
      const noTest = /\[no-test\]/i.test(raw);
      const dependsOn = parseDependsOn(raw);
      const description = stripDependsOn(raw.replace(/\s*\[no-test\]\s*/gi, "")).trim();
      const task: PlanTask = {
        index: parseInt(match[1]),
        description,
        completed: false,
        noTest,
      };
      if (dependsOn) task.dependsOn = dependsOn;
      tasks.push(task);
    }
  }

  return tasks;
}
```

**Verify:** `bun test tests/plan-parser.test.ts`

---

### Task 3: Add `remaining_tasks` to `buildImplementTaskVars` [depends: 1]

**Files:**
- Modify: `extensions/megapowers/prompts.ts`
- Test: `tests/prompts.test.ts`

**Test:** Update the existing failing test in `tests/prompts.test.ts` and add additional cases:

```typescript
it("buildImplementTaskVars includes information about independent tasks for delegation", () => {
  const tasks: PlanTask[] = [
    { index: 1, description: "Set up shared types", completed: true, noTest: false },
    { index: 2, description: "Build auth module", completed: false, noTest: false, dependsOn: [1] },
    { index: 3, description: "Build logging module", completed: false, noTest: false },
  ];
  const vars = buildImplementTaskVars(tasks, 1);
  expect(vars).toHaveProperty("remaining_tasks");
  // Task 3 is independent (no dependsOn, or all deps completed)
  expect(vars.remaining_tasks).toContain("Task 3");
});

it("remaining_tasks marks tasks with unmet dependencies", () => {
  const tasks: PlanTask[] = [
    { index: 1, description: "Types", completed: false, noTest: false },
    { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
    { index: 3, description: "Logging", completed: false, noTest: false },
  ];
  const vars = buildImplementTaskVars(tasks, 0);
  // Task 2 depends on incomplete task 1 — should be marked blocked
  expect(vars.remaining_tasks).toContain("Task 3");
  expect(vars.remaining_tasks).toMatch(/Task 2.*blocked|blocked.*Task 2/i);
});

it("remaining_tasks is empty string when no tasks remain after current", () => {
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
  // Task 3 depends on task 1 which is complete — should be ready
  expect(vars.remaining_tasks).toContain("Task 3");
  expect(vars.remaining_tasks).not.toMatch(/Task 3.*blocked/i);
});
```

**Implementation:**

In `extensions/megapowers/prompts.ts`, add a helper and update `buildImplementTaskVars`:

```typescript
function buildRemainingTasksSummary(
  tasks: PlanTask[],
  currentIndex: number
): string {
  const remaining = tasks.filter((t, i) => i > currentIndex && !t.completed);
  if (remaining.length === 0) {
    return "None — this is the only remaining task.";
  }

  const completedIndices = new Set(
    tasks.filter(t => t.completed).map(t => t.index)
  );

  return remaining
    .map(t => {
      const deps = t.dependsOn ?? [];
      const unmetDeps = deps.filter(d => !completedIndices.has(d));
      if (unmetDeps.length > 0) {
        return `○ Task ${t.index}: ${t.description} [blocked — waiting on task(s) ${unmetDeps.join(", ")}]`;
      }
      return `○ Task ${t.index}: ${t.description} [ready — can be delegated to subagent]`;
    })
    .join("\n");
}
```

Then in the `buildImplementTaskVars` function, add `remaining_tasks` to the returned object:

```typescript
  return {
    current_task_index: String(currentTask?.index ?? currentIndex + 1),
    total_tasks: String(total),
    current_task_description: currentTask
      ? `Task ${currentTask.index}: ${currentTask.description}`
      : "No more tasks.",
    previous_task_summaries: previousSummaries,
    all_tasks_complete: "false",
    remaining_tasks: buildRemainingTasksSummary(tasks, currentIndex),
  };
```

Also add `remaining_tasks` to the all-tasks-complete branch (set it to empty string or "None"):

```typescript
    remaining_tasks: "None — all tasks complete.",
```

**Verify:** `bun test tests/prompts.test.ts`

---

### Task 4: Update implement-task.md prompt with concrete subagent instructions [depends: 3]

**Files:**
- Modify: `prompts/implement-task.md`
- Test: `tests/prompts.test.ts`

**Test:** The existing failing tests in `tests/prompts.test.ts` should now pass. Verify:

```typescript
it("implement-task template includes concrete subagent tool name and invocation format", () => {
  const template = getPhasePromptTemplate("implement");
  expect(template).toContain("subagent");
  expect(template).toMatch(/agent.*worker|worker.*agent/i);
});

it("implement-task template specifies when to delegate vs work inline", () => {
  const template = getPhasePromptTemplate("implement");
  expect(template).toMatch(/when to delegate|delegation criteria|delegate.*independent|independent.*delegate/i);
});
```

**Implementation:**

Replace the `## Execution Mode` section in `prompts/implement-task.md` with:

```markdown
## Execution Mode

### Work inline (default)
Work directly in this session. TDD is enforced via tdd-guard.

### Delegate to subagent (when available)
If the `subagent` tool is available and there are independent remaining tasks, delegate them for parallel execution.

**When to delegate:** Delegate a task when it is marked `[ready — can be delegated to subagent]` in the remaining tasks list below. These tasks have no unmet dependencies and can run in parallel with your current work.

**How to invoke:**
```
subagent({ agent: "worker", task: "Implement Task N: <description>. Follow TDD: write failing test, make it pass, refactor. Files: <relevant files from plan>. Plan context: <paste relevant task section from plan>" })
```

**Do NOT delegate** when:
- The task depends on incomplete tasks (marked `[blocked]`)
- There is only one remaining task
- The task modifies the same files as your current task

Either way, signal task completion when done so megapowers can inspect and advance.

## Remaining Tasks
{{remaining_tasks}}
```

Keep all other sections (Current Task, Previous Tasks, Plan Reference, TDD instructions, Rules, When done report) unchanged.

**Verify:** `bun test tests/prompts.test.ts`

---

### Task 5: Update write-plan.md to document `[depends: N]` annotation [no-test]

**Files:**
- Modify: `prompts/write-plan.md`

**Implementation:**

In `prompts/write-plan.md`, update the task structure template to include the `[depends: N]` annotation and update the rules:

In the task structure block, add after `### Task N: [Name]`:

```markdown
### Task N: [Name] [depends: 1, 2]
```

Add to the rules list:

```markdown
- **Annotate dependencies** — if a task requires output from prior tasks, add `[depends: N, M]` to the title (e.g., `### Task 3: Integration [depends: 1, 2]`). Omit for tasks with no dependencies.
```

**Verify:** `bun test` — all tests pass. The write-plan.md prompt changes are documentation only.
