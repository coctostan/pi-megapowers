---
id: 5
title: Gate revise verdict — return error when revise-instructions file is
  missing (AC5, AC6)
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-review.ts
  - tests/tool-plan-review.test.ts
  - tests/new-session-wiring.test.ts
files_to_create: []
---

### Task 5: Gate revise verdict — return error when revise-instructions file is missing (AC5, AC6)
**Covers:**
- AC5 — When `handlePlanReview` receives `verdict: "revise"`, it validates that `revise-instructions-{planIteration}.md` exists in the plan directory before proceeding
- AC6 — When the revise-instructions file is missing on a `revise` verdict, `handlePlanReview` returns an error message containing the expected filename and full path

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Test: `tests/tool-plan-review.test.ts`
- Fix regressions: `tests/new-session-wiring.test.ts`

**Step 1 — Write the failing test**

Add this describe block to `tests/tool-plan-review.test.ts` after the `"handlePlanReview — approve verdict"` block:

```typescript
describe("handlePlanReview — revise-instructions file gate (missing → error)", () => {
  let tmp: string;
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-gate-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });
  it("returns error when revise-instructions file is missing on revise verdict (AC5, AC6)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const expectedFilepath = join(tmp, ".megapowers", "plans", "001-test", "revise-instructions-1.md");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Task 1 needs work.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("revise-instructions-1.md");
    expect(result.error).toContain(expectedFilepath);
  });
});
```

Also update four existing tests in the `"handlePlanReview — revise verdict"` describe block. Each calls `handlePlanReview` with `verdict: "revise"` and will be blocked by the new gate unless the file is created first.

**"sets planMode to revise and bumps iteration"** (planIteration: 1) — add before `handlePlanReview(...)`:
```typescript
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "Reviewer instructions");
```

**"updates task statuses per verdict arrays"** (planIteration: 1) — add before `handlePlanReview(...)`:
```typescript
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "Reviewer instructions");
```

**"returns error at iteration cap (MAX_PLAN_ITERATIONS = 4)"** (planIteration: 4) — add before `handlePlanReview(...)`:
```typescript
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-4.md"), "Reviewer instructions");
```

**"sets triggerNewSession flag on revise"** (planIteration: 1) — add before `handlePlanReview(...)`:
```typescript
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "Reviewer instructions");
```

Also update `tests/new-session-wiring.test.ts`. The `"megapowers_plan_review(revise) starts a new session"` test calls the tool with `verdict: "revise"` (planIteration: 1) and will fail once the gate is added. In that test, after the `mkdirSync(tasksDir, ...)` / `writeFileSync(task...)` block and before `tools.megapowers_plan_review.execute(...)`, add:

```typescript
      const planDir = join(tmp, ".megapowers", "plans", "001-test");
      writeFileSync(join(planDir, "revise-instructions-1.md"), "Reviewer instructions");
```

(The `planDir` already exists since `tasksDir` = `planDir + /tasks` was created with `mkdirSync(tasksDir, { recursive: true })`; no additional `mkdirSync` needed. `writeFileSync` and `join` are already imported.)

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts --filter "revise-instructions file gate"`

Expected: FAIL —
```
expect(received).toBeDefined()
Received: undefined
```
(`handlePlanReview` currently returns a success message with no `error` field when the file is missing; the gate does not yet exist)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-plan-review.ts`:

1. Update the fs import to include `existsSync`:
```typescript
import { existsSync, writeFileSync } from "node:fs";
```

2. Inside `handlePlanReview`, add the gate immediately after `const slug = state.activeIssue!;` and **before** `const review: PlanReview = {...}` / `writePlanReview(...)` — ensuring it runs before any side effects:

```typescript
  // Gate: revise verdict requires revise-instructions file (AC5, AC6)
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return {
        error:
          `Missing revise-instructions file: ${filepath}\n` +
          `Expected filename: ${filename}\n` +
          "Write it before submitting a revise verdict.",
      };
    }
  }
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-plan-review.test.ts --filter "revise-instructions file gate"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`
Expected: all passing
