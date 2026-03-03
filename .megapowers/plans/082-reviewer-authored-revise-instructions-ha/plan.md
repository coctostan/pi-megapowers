# Plan

### Task 1: Update revise-plan.md to use {{revise_instructions}} template variable [no-test]

### Task 1: Update revise-plan.md to use {{revise_instructions}} template variable [no-test]

**Justification:** Prompt-only change — replaces manual file-reading instruction with a template variable that will be populated by prompt-inject.ts.

**Covers:** AC8 — `revise-plan.md` contains the `{{revise_instructions}}` template variable in its "Reviewer's Instructions" section

**Files:**
- Modify: `prompts/revise-plan.md`

**Step 1 — Make the change**

Replace lines 8-9 of `prompts/revise-plan.md`:

```
## Reviewer's Instructions
Read the review artifact in `.megapowers/plans/{{issue_slug}}/`. Look for `revise-instructions-*.md` — this contains the reviewer's specific, per-task feedback. Read it before proceeding.
```

With:

```
## Reviewer's Instructions
{{revise_instructions}}
```

This replaces the manual file-discovery instruction with a template variable. When `buildInjectedPrompt` populates `vars.revise_instructions` (Task 4), the reviser will see the reviewer's full instructions inline rather than having to discover and read the file manually.

**Step 2 — Verify**
Run: `bun test tests/prompt-inject.test.ts`
Expected: all 27 tests pass (existing tests don't check for the old instruction text; the template variable renders as literal `{{revise_instructions}}` until Task 4 adds the injection logic)

### Task 2: Update review-plan.md to use {{plan_iteration}} template variable [no-test]

### Task 2: Update review-plan.md to use {{plan_iteration}} template variable [no-test]

**Justification:** Prompt-only change — replaces plain-text `{iteration}` references with a template variable that will be populated by prompt-inject.ts.

**Covers:** AC9 — `review-plan.md` contains `{{plan_iteration}}` in its revise-instructions handoff section and "After Review" section

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

In `prompts/review-plan.md`, replace three occurrences of `{iteration}` with `{{plan_iteration}}`:

**Line 76** (Revise-Instructions Handoff section):
```
When your verdict is `revise`, you MUST write a `revise-instructions-{{plan_iteration}}.md` file to the plan directory BEFORE calling the tool. This file is injected directly into the reviser's prompt — it is their primary guide.
```

**Line 78** (Save it to):
```
Save it to: `.megapowers/plans/{{issue_slug}}/revise-instructions-{{plan_iteration}}.md` (where `{{plan_iteration}}` is the current plan iteration number).
```

**Line 124** (After Review section):
```
First, write `revise-instructions-{{plan_iteration}}.md` as described above. Then:
```

**Step 2 — Verify**
Run: `bun test tests/prompt-inject.test.ts`
Expected: all 27 tests pass (existing review-plan tests check for "You are reviewing an implementation plan" which is unaffected; the `{iteration}` → `{{plan_iteration}}` change only affects template variable rendering)

### Task 3: Populate vars.plan_iteration in buildInjectedPrompt when phase is plan [depends: 2]

### Task 3: Populate vars.plan_iteration in buildInjectedPrompt when phase is plan [depends: 2]

**Covers:** AC4 — `vars.plan_iteration` is populated with `String(state.planIteration)` whenever the phase is `"plan"`, regardless of plan mode

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to `tests/prompt-inject.test.ts`, inside a new describe block after the "plan mode routing" block:

```typescript
describe("buildInjectedPrompt — plan phase variable injection", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-plan-vars-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("populates plan_iteration as string when phase is plan (AC4)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 3, megaEnabled: true });
    const store = createStore(tmp);
    // review-plan.md has {{plan_iteration}} after Task 2
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    // The template variable {{plan_iteration}} should be replaced with "3"
    expect(result).toContain("revise-instructions-3.md");
    // Verify it doesn't contain the un-interpolated template variable
    expect(result).not.toContain("{{plan_iteration}}");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts --filter "populates plan_iteration"`
Expected: FAIL — `expect(received).toContain(expected)` — the output contains literal `{{plan_iteration}}` because `vars.plan_iteration` is not yet populated, so `interpolatePrompt` leaves the template variable un-replaced.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add the following block before the plan mode template selection (before the `if (state.phase === "plan" && state.planMode)` block at line 137):

```typescript
  // Plan phase: inject plan_iteration for template variables (AC4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
  }
```

Insert this between the learnings/roadmap block (line 128) and the plan mode template selection block (line 137).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts --filter "populates plan_iteration"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Inject vars.revise_instructions from file when planMode is revise (AC1) [depends: 1, 3]

### Task 4: Inject vars.revise_instructions from file when planMode is revise (AC1) [depends: 1, 3]
**Covers:**
- AC1 — When `planMode` is `"revise"` and `revise-instructions-{planIteration - 1}.md` exists, `buildInjectedPrompt` populates `vars.revise_instructions` with the file's full content

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`
**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — plan phase variable injection"` describe block in `tests/prompt-inject.test.ts` (created in Task 3):

```typescript
  it("populates revise_instructions from file when planMode is revise (AC1)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const store = createStore(tmp);
    // planIteration - 1 = 1; reviewer at iteration 1 wrote revise-instructions-1.md
    store.writePlanFile("001-test", "revise-instructions-1.md", "## Task 3: Fix test\n\nStep 2 needs specific error message.");
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(result).toContain("## Task 3: Fix test");
    expect(result).toContain("Step 2 needs specific error message.");
    expect(result).not.toContain("{{revise_instructions}}");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts --filter "populates revise_instructions from file"`

Expected: FAIL —
```
expect(received).toContain(expected)
Expected substring: "## Task 3: Fix test"
Received: "...{{revise_instructions}}..."
```
(`vars.revise_instructions` is not yet populated so `interpolatePrompt` leaves the token unreplaced)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, expand the plan-phase block added in Task 3. This block must live **before** `const phasePrompt = interpolatePrompt(template, vars)` so the token is replaced during interpolation. Change:

```typescript
  // Plan phase: inject plan_iteration for template variables (AC4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
  }
```

To:

```typescript
  // Plan phase: inject plan_iteration and revise_instructions (AC1-4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);

    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      if (content !== null) {
        vars.revise_instructions = content;
      }
      // AC2 empty-string fallback is added in Task 6
    }
  }
```

The iteration math is intentional: reviewer at iteration `N` writes `revise-instructions-N.md`; reviser at iteration `N+1` reads `revise-instructions-{N+1-1}.md` = `revise-instructions-N.md`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts --filter "populates revise_instructions from file"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`
Expected: all passing

### Task 5: Gate revise verdict — return error when revise-instructions file is missing (AC5, AC6)

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

### Task 6: Fallback vars.revise_instructions to empty string when file is missing (AC2) [depends: 4]

### Task 6: Fallback vars.revise_instructions to empty string when file is missing (AC2) [depends: 4]

**Covers:**
- AC2 — When `planMode` is `"revise"` and the revise-instructions file does not exist, `vars.revise_instructions` is set to empty string (so the template token is replaced with "" rather than left as literal `{{revise_instructions}}`)

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — plan phase variable injection"` describe block in `tests/prompt-inject.test.ts`:

```typescript
  it("sets revise_instructions to empty string when file is missing in revise mode (AC2)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const store = createStore(tmp);
    // No revise-instructions-1.md written — file is missing
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    // Token must be replaced (not left as literal template variable)
    expect(result).not.toContain("{{revise_instructions}}");
    // Both surrounding headings should still be present
    expect(result).toContain("## Reviewer's Instructions");
    expect(result).toContain("## Quality Bar");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts --filter "sets revise_instructions to empty string"`

Expected: FAIL —
```
expect(received).not.toContain(expected)
Expected substring not to be found: "{{revise_instructions}}"
Received: "...{{revise_instructions}}..."
```
(After Task 4's implementation, `vars.revise_instructions` is only set when `content !== null`. When the file is missing, `content` is `null` and the key is never added to `vars`, leaving the token unreplaced.)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, update the revise block added in Task 4. Change:

```typescript
    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      if (content !== null) {
        vars.revise_instructions = content;
      }
      // AC2 empty-string fallback is added in Task 6
    }
```

To:

```typescript
    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      vars.revise_instructions = content ?? "";
    }
```

The `?? ""` ensures the template token `{{revise_instructions}}` is always replaced — with the file's content when it exists, or with an empty string when it does not.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts --filter "sets revise_instructions to empty string"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 7: Guard vars.revise_instructions behind planMode check — draft mode does not read (AC3) [depends: 4]

### Task 7: Guard vars.revise_instructions behind planMode check — draft mode does not read (AC3) [depends: 4]

**Covers:**
- AC3 — When `planMode` is `"draft"`, `vars.revise_instructions` is not populated, and `store.readPlanFile` is never called for revise-instructions files

**Files:**
- Test: `tests/prompt-inject.test.ts`
- (No production code change needed — the `if (state.planMode === "revise" && store)` guard from Task 4 already handles this; this task adds the regression test to catch any future removal of that guard)

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — plan phase variable injection"` describe block in `tests/prompt-inject.test.ts`:

```typescript
  it("does not read revise-instructions-* files when planMode is draft (AC3)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const store = createStore(tmp);

    const calls: string[] = [];
    const originalReadPlanFile = store.readPlanFile.bind(store);
    (store as any).readPlanFile = (slug: string, filename: string) => {
      calls.push(filename);
      return originalReadPlanFile(slug, filename);
    };

    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(calls.some(f => f.startsWith("revise-instructions-"))).toBe(false);
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts --filter "does not read revise-instructions"`

Expected: PASS (the `if (state.planMode === "revise" && store)` guard from Task 4 already prevents revise-instructions reads in draft mode — this test is a regression guard)

To verify the test actively catches regressions: temporarily remove the `state.planMode === "revise" &&` condition from the Task 4/6 block, run again → Expected: FAIL — `expect(received).toBe(false)` where received is `true` (because `calls` now contains `"revise-instructions-0.md"`). Restore the guard.

**Step 3 — No production code changes**

No changes to `extensions/megapowers/prompt-inject.ts` are needed. The `if (state.planMode === "revise" && store)` guard from Tasks 4/6 correctly prevents revise-instructions reads when `planMode` is `"draft"`.

**Step 4 — Confirm test passes**

Run: `bun test tests/prompt-inject.test.ts --filter "does not read revise-instructions"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 8: Gate revise verdict passes when revise-instructions file exists (AC5 happy-path) [depends: 5]

### Task 8: Gate revise verdict passes when revise-instructions file exists (AC5 happy-path) [depends: 5]

**Covers:**
- AC5 (happy-path) — When `handlePlanReview` receives `verdict: "revise"` and `revise-instructions-{planIteration}.md` exists in the plan directory, the function proceeds without error

**Files:**
- Test: `tests/tool-plan-review.test.ts`
- (No production code change needed — Task 5's `if (!existsSync(filepath))` gate already allows execution when the file is present)

**Step 1 — Write the failing test**

Add to the `"handlePlanReview — revise-instructions file gate (missing → error)"` describe block in `tests/tool-plan-review.test.ts`:

```typescript
  it("succeeds when revise-instructions file exists on revise verdict (AC5 happy-path)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "## Task 1\nFix step 2.");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Task 1 needs work.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("REVISE");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts --filter "succeeds when revise-instructions file exists"`

Expected: PASS (file exists → `existsSync` returns `true` → gate allows execution → `handleReviseVerdict` returns a REVISE message with no error)

To verify the test catches regressions: remove the `writeFileSync(...)` line for `revise-instructions-1.md` and run again → Expected: FAIL — `expect(received).toBeUndefined()` where received is `"Missing revise-instructions file: ..."`. Restore the line.

**Step 3 — No production code changes**

No changes to `extensions/megapowers/tools/tool-plan-review.ts` are needed. The gate from Task 5 correctly allows execution when the file exists.

**Step 4 — Confirm test passes**

Run: `bun test tests/tool-plan-review.test.ts --filter "succeeds when revise-instructions file exists"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 9: Approve verdict does not check for revise-instructions file (AC7) [depends: 5]

### Task 9: Approve verdict does not check for revise-instructions file (AC7) [depends: 5]

**Covers:**
- AC7 — When `handlePlanReview` receives `verdict: "approve"`, no revise-instructions file check is performed

**Files:**
- Test: `tests/tool-plan-review.test.ts`
- (No production code change needed — the gate from Task 5 is inside `if (params.verdict === "revise")`, so approve verdicts bypass it entirely)

**Step 1 — Write the failing test**

Add to the `"handlePlanReview — revise-instructions file gate (missing → error)"` describe block in `tests/tool-plan-review.test.ts`:

```typescript
  it("does not check for revise-instructions file on approve verdict (AC7)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    // No revise-instructions-1.md written — if the gate ran on approve, this would return an error

    const result = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Looks great.",
      approved_tasks: [1],
      needs_revision_tasks: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("approved");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts --filter "does not check for revise-instructions file on approve"`

Expected: PASS (`params.verdict === "revise"` is `false` for approve → gate is skipped → `handleApproveVerdict` runs normally and returns a success message)

To verify the test catches regressions: change the gate condition in Task 5's implementation to `if (params.verdict !== "")` (making it run for all verdicts), run again → Expected: FAIL — `expect(received).toBeUndefined()` where received contains `"Missing revise-instructions file: ..."`. Restore the condition.

**Step 3 — No production code changes**

No changes to `extensions/megapowers/tools/tool-plan-review.ts` are needed. The `if (params.verdict === "revise")` guard from Task 5 correctly restricts the file check to revise verdicts only.

**Step 4 — Confirm test passes**

Run: `bun test tests/tool-plan-review.test.ts --filter "does not check for revise-instructions file on approve"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
