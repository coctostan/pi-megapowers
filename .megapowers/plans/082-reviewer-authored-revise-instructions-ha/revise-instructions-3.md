# Revise Instructions — Iteration 3

These revisions are required before I can approve the plan. Focus only on the tasks called out below.

## Task 4: Populate vars.revise_instructions from file when planMode is revise

### Problem 1 — Violates the plan’s granularity rule (one task = one test + one implementation)
Task 4 currently adds **three separate tests** (AC1/AC2/AC3) and one implementation. Per the plan quality bar, this should be split.

**Fix:** Split Task 4 into separate tasks (recommended), e.g.
- **Task 4**: AC1 (file exists → inject full content)
- **Task 6** (new): AC2 (file missing → inject empty string)
- **Task 7** (new): AC3 (planMode=draft → do not read revise-instructions files)

If you split tasks, update `depends_on` accordingly:
- AC1/AC2 tasks should depend on **Task 1** (revise-plan template var) and **Task 3** (plan-phase injection block)
- The AC3 task can depend on **Task 3** only

### Problem 2 — AC2 test assertion is brittle (newline-sensitive)
The current AC2 expectation:
```ts
expect(result).toContain("## Reviewer's Instructions\n\n## Quality Bar");
```
will be fragile because `{{revise_instructions}}` being replaced with `""` may leave **extra newlines** depending on the template layout.

**Fix:** Assert intent, not exact whitespace. For the “missing file” case, use something like:
```ts
expect(result).toContain("## Reviewer's Instructions");
expect(result).toContain("## Quality Bar");
expect(result).not.toContain("{{revise_instructions}}");
// Optional: ensure the old manual instruction line is gone
expect(result).not.toContain("Look for `revise-instructions-*.md`");
```

### Problem 3 — Make the plan explicit about *where* the injection code goes
Your Step 3 is basically correct, but make sure the plan explicitly says the logic must live **before**:
```ts
const phasePrompt = interpolatePrompt(template, vars);
```
so interpolation can actually replace `{{revise_instructions}}`.

A good minimal implementation shape in `extensions/megapowers/prompt-inject.ts` is:
```ts
if (state.phase === "plan") {
  vars.plan_iteration = String(state.planIteration);

  if (state.planMode === "revise") {
    const filename = `revise-instructions-${state.planIteration - 1}.md`;
    vars.revise_instructions = store ? (store.readPlanFile(state.activeIssue!, filename) ?? "") : "";
  }
}
```
(Exact formatting can differ, but keep the behavior the same.)

## Task 5: Gate revise verdict on revise-instructions file existence in handlePlanReview

### Problem 1 — Violates the plan’s granularity rule (one task = one test + one implementation)
Task 5 currently introduces **three tests** (missing file → error, file exists → success, approve → no check). This should be split into separate tasks.

**Fix:** Split into e.g.
- **Task 5**: AC5/AC6 (revise + missing file → error includes filename and full path)
- **Task 8** (new): AC5 happy-path (revise + file exists → proceeds)
- **Task 9** (new): AC7 (approve verdict does not check)

### Problem 2 — Test suite updates are incomplete
You correctly noted `tests/tool-plan-review.test.ts` must be updated so existing `verdict: "revise"` tests create the required file.

But there is **another test** that calls the tool with `verdict: "revise"` and will start failing after the gate is added:
- `tests/new-session-wiring.test.ts` (the `megapowers_plan_review(revise) starts a new session` test)

**Fix:** In that test, create the required file before calling the tool:
```ts
const planDir = join(tmp, ".megapowers", "plans", "001-test");
mkdirSync(planDir, { recursive: true });
writeFileSync(join(planDir, "revise-instructions-1.md"), "Reviewer instructions");
```

### Problem 3 — Gate must run before any side effects
Make it explicit in Step 3 that the existence check must happen **before**:
- `writePlanReview(...)`
- `updateTaskStatuses(...)`
- any `writeState(...)`

Concretely: insert the gate in `handlePlanReview()` immediately after `slug` is derived and before `const review = ...` / `writePlanReview(...)`.

---

When you revise the plan, keep Tasks 1–3 unchanged (they look correct). Only revise the tasks called out above and add new tasks if you split as suggested.
