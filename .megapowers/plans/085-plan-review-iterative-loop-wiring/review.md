# Plan Review — 085-plan-review-iterative-loop-wiring

## Summary Verdict: **revise**

The plan is close, but a few tasks have dependency/order issues and a couple of steps are not self-contained or are likely incorrect vs the current codebase signatures. Address the items called out below, then resubmit.

---

## Per-Task Assessment

### Task 1: Entity parser — parseFrontmatterEntity and serializeEntity — ✅ PASS
No issues.

### Task 2: Plan schemas — PlanTaskSchema, PlanReviewSchema — ✅ PASS
No issues.

### Task 3: Plan store — write, read, list operations — ✅ PASS
No issues.

### Task 4: State machine — planMode and planIteration fields — ✅ PASS
No issues.

### Task 5: Transition hooks — planMode set on enter/leave plan phase — ❌ REVISE
- **Missing / conflicting implementation detail (Step 3):** current `transition()` already has a `if (to === "plan") { next.reviewApproved = false; }` block. Your Step 3 says “After the existing `if (to === "plan")` block, add … `next.reviewApproved = false; next.planMode = ...`”. This will either duplicate `reviewApproved = false` or require merging the blocks. Make the plan explicit: **edit the existing `to === "plan"` block** to set `planMode`/`planIteration` and keep a single `reviewApproved = false` assignment.
- **Leaving-plan hook needs to be specified precisely:** add `if (state.phase === "plan" && to !== "plan") next.planMode = null;` (good), but also confirm whether `planIteration` should be reset/left as-is on leave. AC only mentions `planMode` reset; plan should say explicitly “planIteration preserved on leave.”

### Task 6: Workflow configs — remove review phase — ✅ PASS
No issues.

### Task 7: tool-plan-task — create new tasks — ❌ REVISE
- **AC 13 mismatch (response details):** AC 13 requires: “tool response includes task file path, task title, and field change summary.” The Step 3 response includes file path + title, but **no field-change summary on create** (it prints depends/files counts). Update the plan so create responses include a consistent “Changed: …” list (e.g., `Changed: id, title, description, ...`), or clarify that “field change summary” applies to updates only (but AC 13 does not say that).
- **Parse error handling is unspecified:** if `readPlanTask()` returns `{ error }` (parse failure), Step 3 treats it as non-existent and proceeds to create/overwrite. Decide and document expected behavior (recommended: **return an error** directing manual fix, rather than overwriting).

### Task 8: tool-plan-task — update existing tasks (partial merge) — ✅ PASS
No issues.

### Task 9: plan_draft_done signal — ✅ PASS
No issues.

### Task 10: review_approve deprecation signal — ✅ PASS
No issues.

### Task 11: generateLegacyPlanMd bridge — ✅ PASS
No issues.

### Task 12: tool-plan-review — revise verdict — ✅ PASS
No issues.

### Task 13: tool-plan-review — approve verdict — ❌ REVISE
- **Step 3 likely incorrect / unnecessary imports and flow:**
  - It imports `deriveTasks` and uses it solely to compute `derivedTasks` for `transition(...)`. This creates a coupling to the legacy regex-derived tasks at the exact moment you are generating `plan.md`. It might be fine, but the plan should **explicitly justify** why it’s needed (current `transition(state,to,tasks?)` uses tasks to pick first incomplete task index).
  - The code sets `planMode: null as any` (type escape). This should not be necessary once Task 5 is implemented; plan should remove the `as any` and rely on the leave-plan hook, or set `planMode: null` with the correct type.
  - The plan’s Step 3 references `transition(updatedState, "implement" as Phase, derivedTasks);` — confirm that `deriveTasks()` returns the `PlanTask[]` type expected by `transition(..., tasks?: PlanTask[])` (from current `state-machine.ts`, `PlanTask` is the legacy parser task type). If it doesn’t, this step will not compile. Update the plan to ensure types align (or call `transition(state, "implement")` without tasks and accept `currentTaskIndex` behavior).
- **Missing explicit file write location contract:** you write `.megapowers/plans/<slug>/plan.md` with `writeFileSync` but don’t ensure the directory exists in this step. It probably exists due to tasks/reviews, but the plan should say “ensure `.megapowers/plans/<slug>/` exists (mkdir recursive) before writing plan.md” to be self-contained.

### Task 14: Write policy — plan mode awareness — ❌ REVISE
- **Granularity:** This task modifies **three production files** (`write-policy.ts`, `tool-overrides.ts`, `hooks.ts`) and adds a new test file. This is more than “one test + one implementation” and is likely to become a debugging sink.
  - Split into (A) pure policy function signature + behavior + unit tests, then (B) hook/override wiring + a small integration/unit test for wiring.
- **Plan must acknowledge current signature:** current `canWrite(...)` has 5 parameters and returns early allowing all `.megapowers/` writes. The plan should clearly call out the exact location of the early return and how it changes.

### Task 15: Prompt routing — planMode-aware template selection — ❌ REVISE
- **Dependency ordering error:** This task is marked `[depends: 4, 16]`, but Task 16 is “prompt templates changes” and should not be a prerequisite for routing logic; routing can be implemented and tested with current templates.
  - Fix: **Task 15 should depend only on Task 4**.
  - Task 16 should depend on Task 15 (or have no dependency) since it’s content only.
- **Self-containment:** Step 1 contains a note “update or remove those tests” but doesn’t list which existing tests. Add explicit instructions: identify the specific test blocks/files to update and the exact new expected behavior.

### Task 16: Prompt templates — update write-plan.md, review-plan.md, ... create revise-plan.md — ❌ REVISE
- **Not self-contained:** It references concrete anchors like `Line 8 (8:b1)` that look like `read` hash anchors. Those anchors are **not stable** and can’t be relied on by someone executing the plan later.
  - Replace with: “search for the `phase_back` bullet and update the parenthetical…” and/or provide the exact surrounding text to match.
- **Granularity:** This task edits **10+ prompt files** in one go. If it stays `[no-test]`, at least break it into 2–3 smaller content tasks (protocol + plan prompts + other diagrams) to reduce review/merge risk.
- **Verification step is OK** (it says run `bun test`), but make it explicit that prompt-only changes shouldn’t change tests except prompt-inject routing tests.

### Task 17: Tool registration — wire new tools into pi — ✅ PASS
No issues.

### Task 18: newSession wiring — reset context on plan mode transitions — ❌ REVISE
- **Potential mismatch with existing code structure:** the plan says “In hooks.ts, export `onContext`” and provides a full replacement-looking snippet. This risks diverging from the existing hooks implementation. Update the plan to be explicit: **add an export for the existing handler** (or refactor minimally) rather than rewriting.
- **Tool wrapper behavior needs to be precise:** the plan says to call `ctx.sessionManager.newSession({ parentSession: ... })` when `triggerNewSession` is true. Confirm whether `newSession()` is async and whether the tool execute wrapper should `await` it. Add that detail to avoid race conditions.

---

## Missing Coverage
None. The AC coverage map covers AC 1–38.

---

## Ordering & Dependencies (global)
- Fix the **Task 15 ↔ Task 16 dependency** (currently backwards).
- Consider splitting Task 14 and Task 16 for granularity.

---

## Final Verdict
**revise** — address the Task 5/7/13/14/15/16/18 issues above (mostly ordering + self-containment + a few likely compile/type problems), then resubmit for review.
