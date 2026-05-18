---
id: 16
title: Standardize plan_review approve/revise feedback
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/plan-orchestrator.ts
  - extensions/megapowers/tools/tool-plan-review.ts
  - tests/tool-plan-review.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Modify: `tests/tool-plan-review.test.ts`

Covers AC47, AC48, AC49, AC50, AC51. Route `transitionReviewToRevise` messages through `composeMessage` and have `handleApproveVerdict` compose the approve message at the tool layer so the slug-aware `plan.md` artifact path is included. Error messages identify `plan_review` and a corrective action.

**Step 1 — Write the failing test**

Append to `tests/tool-plan-review.test.ts`:

```ts
describe("handlePlanReview — message shape", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-shape-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("revise message includes iteration, approved IDs, needs-revision IDs, and transition next-step (AC47)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "instructions");

    const r = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "fix it",
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });
    expect(r.error).toBeUndefined();
    expect(r.message).toContain("iteration 2");
    expect(r.message).toContain("1"); // approved id
    expect(r.message).toContain("2"); // revise id
    expect(r.message!.toLowerCase()).toContain("revise mode");
  });

  it("approve message includes iteration, count of approved tasks, plan.md artifact path, and implement next-step (AC48, AC51)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 2 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    const r = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "all good",
      approved_tasks: [1, 2],
    });
    expect(r.error).toBeUndefined();
    expect(r.message).toContain("iteration 2");
    expect(r.message).toContain("2"); // approved count
    expect(r.message).toContain(".megapowers/plans/001-test/plan.md");
    expect(r.message!.toLowerCase()).toContain("implement");
  });

  it("revise verdict at iteration cap returns error naming plan_review and corrective action (AC49)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 4 });
    createTaskFile(tmp, 1, "T1");
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-4.md"), "instr");
    const r = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "x",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(r.error).toBeDefined();
    expect(r.error).toContain("plan_review");
  });

  it("missing revise-instructions error names plan_review and tells the user to write the file (AC49)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    const r = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "x",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(r.error).toBeDefined();
    expect(r.error).toContain("plan_review");
    expect(r.error!.toLowerCase()).toMatch(/write .* revise-instructions/);
  });

  it("wrong-phase error names plan_review (AC49)", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const r = handlePlanReview(tmp, { verdict: "approve", feedback: "x" });
    expect(r.error).toBeDefined();
    expect(r.error).toContain("plan_review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review.test.ts -t "message shape"`
Expected: FAIL — at minimum:
- `expect(r.message).toContain(".megapowers/plans/001-test/plan.md")` — current approve message lacks the relative path.
- `expect(r.error).toContain("plan_review")` for the iteration-cap and missing-revise-instructions errors — neither current error string contains the `plan_review` token. (The wrong-phase case happens to pass already because `megapowers_plan_review` contains the substring.)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/plan-orchestrator.ts`:

1. Add at the top (if not present from Task 13): `import { composeMessage } from "./feedback.js";`

2. In `transitionReviewToRevise`, replace the iteration-cap error (lines 122–125):

```ts
      error: composeMessage({
        icon: "warn",
        summary: `plan_review: reached ${maxIterations} iterations without approval — Human intervention needed`,
        nextStep: "Use /mega off to disable enforcement and manually advance, or revise the spec.",
      }),
```

3. In `transitionReviewToRevise`, replace the revise success-message (lines 137–140):

```ts
      message: composeMessage({
        icon: "info",
        summary: `Plan review: REVISE (iteration ${state.planIteration + 1} of ${maxIterations})`,
        changes: [
          `Tasks ${approvedIds.join(", ") || "none"} approved`,
          `Tasks ${needsRevisionIds.join(", ") || "none"} need revision`,
        ],
        nextStep: "Transitioning to revise mode. A new review session will start.",
      }),
```

Do not change `approvePlan`'s shape or return type — the tool layer overrides its `message`.

In `extensions/megapowers/tools/tool-plan-review.ts`:

1. Add at the top: `import { composeMessage } from "../feedback.js";`

2. Update wrong-phase / wrong-planMode errors (lines 26–32):

```ts
  if (state.phase !== "plan") {
    return { error: "❌ plan_review: not in plan phase. Submit during plan review." };
  }

  if (state.planMode !== "review") {
    return { error: `❌ plan_review: not in review mode (got planMode '${state.planMode}'). Submit during plan review.` };
  }
```

3. Update missing-revise-instructions error (lines 41–47):

```ts
      return {
        error: composeMessage({
          icon: "error",
          summary: `plan_review: missing revise-instructions file at ${filepath}`,
          nextStep: `Write ${filename} before submitting a revise verdict.`,
        }),
      };
```

4. In `handleApproveVerdict` (line 95), replace the final return (lines 119–122) with a composed message that includes the slug-specific artifact path:

```ts
  updateTaskStatuses(
    cwd,
    slug,
    orchestrated.value.statusUpdates.map((update) => update.taskId),
    "approved",
  );
  const planDir = join(cwd, ".megapowers", "plans", slug);
  writeFileSync(join(planDir, "plan.md"), orchestrated.value.legacyPlanMd);
  writeState(cwd, orchestrated.value.nextState);
  return {
    message: composeMessage({
      icon: "success",
      summary: `Plan approved (iteration ${state.planIteration})`,
      changes: [`All ${tasks.length} tasks approved`],
      artifactPath: `.megapowers/plans/${slug}/plan.md`,
      nextStep: "Advancing to implement phase.",
    }),
    triggerNewSession: true,
  };
```

The existing test `it("returns success message with task count", ...)` asserts `toContain("approved")`, `toContain("2")`, and `toContain("implement")` — all three substrings remain in the composed message.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
