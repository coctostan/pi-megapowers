# Plan Review Feedback — 085-plan-review-iterative-loop-wiring

## Per-Task Assessment

### Task 1: Entity parser — parseFrontmatterEntity and serializeEntity — ✅ PASS
pass

### Task 2: Plan schemas — PlanTaskSchema, PlanReviewSchema — ✅ PASS
pass

### Task 3: Plan store — write, read, list operations — ✅ PASS
pass

### Task 4: State machine — planMode and planIteration fields — ✅ PASS
pass

### Task 5: Transition hooks — planMode set on enter/leave plan phase — ✅ PASS
pass

### Task 6: Workflow configs — remove review phase — ✅ PASS
pass

### Task 7: tool-plan-task — create new tasks — ❌ REVISE
Granularity/TDD mismatch: Step 3 includes update logic (`handleUpdate`) even though Task 8 is “update existing tasks”. This makes Task 8 non-TDD (tests may pass immediately) and Task 7 does “create + update”.

**Targeted edits (plan.md):**
- **In Task 7 Step 3 code**, remove the update path and the `handleUpdate` function.

  Replace lines:
  - `1044:1e|  // Update existing task`
  - `1045:90|  if (existing && !("error" in existing)) {`
  - `1046:49|    return handleUpdate(cwd, slug, existing, params);`
  - `1047:18|  }`

  with:
  ```ts
  // Existing task updates are implemented in Task 8
  if (existing && !("error" in existing)) {
    return { error: `❌ Task ${params.id} already exists. Updates are implemented in Task 8.` };
  }
  ```

- **Delete the `handleUpdate` block** from Task 7 Step 3 implementation snippet:
  - start: `1082:78|function handleUpdate(`
  - end: `1123:18|}`

### Task 8: tool-plan-task — update existing tasks (partial merge) — ❌ REVISE
- **Step 2 expected failure is vague/non-deterministic** and currently says tests “should pass” because impl is already in Task 7 (violates TDD completeness).
- The revise-mode test contains indecision/commentary and implicitly tests “create in revise mode” (not specified).

**Targeted edits (plan.md):**
- Update file list line to remove “already implemented”:
  - `1141:a7|- Modify: ... (already implemented in Task 7)` → remove parenthetical.

- Fix Step 2 expected failure to be specific *after* Task 7 is create-only:
  - Replace `1222:3d|Expected: FAIL — ... Since the implementation was included in Task 7, these tests should pass...`
  with:
  ```md
  Expected: FAIL — update attempts return an error like "Task 1 already exists. Updates are implemented in Task 8."
  ```

- Replace the “works in revise mode” test block to remove commentary and avoid “create in revise”:

  Replace lines:
  - `1205:41|  it("works in revise mode", () => {` through `1211:05|    // Actually spec says ...`

  with:
  ```ts
  it("works in revise mode (updates existing task)", () => {
    // Create in draft
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "B." });

    // Update in revise
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const result = handlePlanTask(tmp, { id: 1, no_test: true });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.no_test).toBe(true);
  });
  ```

### Task 9: plan_draft_done signal — ❌ REVISE
AC21/35 require **actually triggering `newSession()`**, but the plan only adds a `triggerNewSession` flag. There is **no wiring** in the repo that consumes this flag.

**Targeted edit (plan.md):**
- Remove/soften the claim that newSession “will be called” until there is a concrete wiring task:
  - `1360:91|... newSession() will be called.` → change to “should be called (see Task X wiring)”.

### Task 10: review_approve deprecation signal — ✅ PASS
pass

### Task 11: generateLegacyPlanMd bridge — ✅ PASS
pass

### Task 12: tool-plan-review — revise verdict — ❌ REVISE
Same `newSession()` issue as Task 9: the flag is not consumed anywhere, so AC35 is not met.

### Task 13: tool-plan-review — approve verdict — ✅ PASS
pass (once newSession wiring is reworked, re-check messaging consistency)

### Task 14: Write policy — plan mode awareness — ❌ REVISE
The task instructions modify `extensions/megapowers/hooks.ts`, but the **Files** list omits it (self-containment failure).

**Targeted edit (plan.md):**
- Add hooks.ts to file list:
  - after `1960:23|- Modify: extensions/megapowers/tools/tool-overrides.ts`
  insert:
  ```md
  - Modify: `extensions/megapowers/hooks.ts`
  ```

### Task 15: Prompt routing — planMode-aware template selection — ❌ REVISE
Dependency/order issue: Task 15 Step 1 asserts prompt output contains strings that **do not exist in current templates** until Task 16 edits them. So Task 15 effectively depends on Task 16.

**Targeted edits (plan.md):**
- Update header dependency:
  - `2119:c9|### Task 15: ... [depends: 4]`
  → `### Task 15: ... [depends: 4, 16]`

Also: removing the workflow `review` phase will require updating existing tests that currently set `phase: "review"` (see repo `tests/prompt-inject.test.ts`). Add a note in Task 15 Step 1 to update/remove the existing “review phase” prompt-inject test to the new planMode-based review.

### Task 16: Prompt templates — update write-plan.md, review-plan.md, create revise-plan.md — ✅ PASS
pass (but must be done before Task 15’s new assertions, hence Task 15 dependency fix above)

### Task 17: Tool registration — wire new tools into pi — ❌ REVISE
Still missing a concrete plan item that **actually calls `newSession()`** on mode transitions (AC21/35). Add a dedicated wiring task (or extend Task 17) that consumes `triggerNewSession` and invokes new session behavior.

## Missing Coverage
- **AC 21 / AC 35 (newSession integration):** currently only a flag is proposed; no consumer exists in repo (`triggerNewSession` / `newSession` not referenced). Needs a concrete wiring task.

## Verdict
**revise**
