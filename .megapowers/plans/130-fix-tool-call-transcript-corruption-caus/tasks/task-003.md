---
id: 3
title: Remove review session-reset instructions
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-review.ts
  - tests/tool-plan-review.test.ts
  - extensions/megapowers/plan-orchestrator.ts
files_to_create: []
---

### Task 3: Remove review session-reset instructions [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Modify: `tests/tool-plan-review.test.ts`
- Modify: `extensions/megapowers/plan-orchestrator.ts`

Covers Fixed When 1–3 and 6–7 for review results. Preserve review files, task statuses, plan iteration, revise-instructions gates, legacy plan.md, and transition-to-implement logic.

Grounding: `handlePlanReview(cwd: string, params: PlanReviewParams): PlanReviewResult` and private `handleApproveVerdict(cwd, state, slug): PlanReviewResult` were read by symbol. `impact([PlanReviewResult], signature_change)` found no indexed call-edge dependents; explicit search found this producer, the wrapper removed in Task 1, and `tests/tool-plan-review.test.ts`. Do not interpret the graph result as proof there were no consumers.

Revision grounding: `read(symbol)` and `symbol_graph` confirm `transitionReviewToRevise(state: MegapowersState, approvedIds: number[], needsRevisionIds: number[], maxIterations: number): OrchestratorResult<PlanTransitionResult>` and `composeMessage(args: ComposeArgs): string`. AST search confirms the success-result `composeMessage` call owns the obsolete `nextStep`. All Step 3 local callees were checked against their current source signatures; Node fs/path helpers remain the existing imports.

**Step 1 — Write the failing test**
Append this complete describe block at EOF in `tests/tool-plan-review.test.ts`. All imports used below already exist at its top; no extra dependency or shared fixture helper is needed.

```ts
describe("plan-review session policy", () => {
  it("successful review verdicts return no session-reset instruction", () => {
    for (const verdict of ["approve", "revise"] as const) {
      const cwd = mkdtempSync(join(tmpdir(), "review-policy-"));
      try {
        const dir = join(cwd, ".megapowers", "plans", "001-test");
        mkdirSync(join(dir, "tasks"), { recursive: true });
        writeFileSync(join(dir, "tasks", "task-001.md"), "---\nid: 1\ntitle: First\nstatus: draft\n---\nBody.");
        writeFileSync(join(dir, "revise-instructions-1.md"), "Fix task 1.");
        writeState(cwd, { ...createInitialState(), activeIssue: "001-test", workflow: "feature",
          phase: "plan", planMode: "review", planIteration: 1 });
        const result = handlePlanReview(cwd, {
          verdict, feedback: "Review feedback",
          approved_tasks: verdict === "approve" ? [1] : [],
          needs_revision_tasks: verdict === "revise" ? [1] : [],
        });
        expect(result.error).toBeUndefined();
        if (verdict === "revise") {
          expect(result.message).toContain("current Pi session");
          expect(result.message).not.toMatch(/new review session|starts a new session|fresh session/i);
        }
        expect(result).not.toHaveProperty("triggerNewSession");
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review.test.ts -t "plan-review session policy"`
Expected: FAIL. The actual approve-handler probe emitted:
```text
error: expect(received).not.toHaveProperty(path)

Expected path: not "triggerNewSession"

Received value: true
```

The approve-first loop initially fails on the no-flag assertion above. After flag cleanup, the revise message assertion independently fails until `transitionReviewToRevise`'s next step is corrected:
```text
error: expect(received).toContain(expected)

Expected to contain: "current Pi session"
Received: "📋 Plan review: REVISE (iteration 2 of 4)\n  • Tasks none approved\n  • Tasks 1 need revision\n  Next: Transitioning to revise mode. A new review session will start."
```
Keep both verdict fixtures and the no-flag assertion.

**Step 3 — Write minimal implementation**
Replace the existing interface and these two function bodies with the complete code below. Keep every other symbol and import unchanged.

```ts
export interface PlanReviewResult {
  message?: string;
  error?: string;
}

export function handlePlanReview(cwd: string, params: PlanReviewParams): PlanReviewResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "❌ plan_review: not in plan phase. Submit during plan review." };
  }

  if (state.planMode !== "review") {
    return { error: `❌ plan_review: not in review mode (got planMode '${state.planMode}'). Submit during plan review.` };
  }

  const slug = state.activeIssue!;

  // Gate: revise verdict requires revise-instructions file (AC5, AC6)
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return {
        error: composeMessage({
          icon: "error",
          summary: `plan_review: missing revise-instructions file at ${filepath}`,
          nextStep: `Write the ${filename} file before submitting a revise verdict.`,
        }),
      };
    }
  }
  const approvedIds = params.approved_tasks ?? [];
  const needsRevisionIds = params.needs_revision_tasks ?? [];

  const review: PlanReview = {
    type: "plan-review",
    iteration: state.planIteration,
    verdict: params.verdict,
    reviewed_tasks: [...approvedIds, ...needsRevisionIds],
    approved_tasks: approvedIds,
    needs_revision_tasks: needsRevisionIds,
  };
  if (params.verdict === "revise") {
    const orchestrated = transitionReviewToRevise(
      state,
      approvedIds,
      needsRevisionIds,
      MAX_PLAN_ITERATIONS,
    );
    if (!orchestrated.ok) {
      return { error: orchestrated.error };
    }
    writePlanReview(cwd, slug, review, params.feedback);
    updateTaskStatuses(cwd, slug, approvedIds, "approved");
    updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
    writeState(cwd, orchestrated.value.nextState);
    return {
      message: orchestrated.value.message,
    };
  }

  writePlanReview(cwd, slug, review, params.feedback);
  updateTaskStatuses(cwd, slug, approvedIds, "approved");
  updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
  return handleApproveVerdict(cwd, state, slug);
}

function handleApproveVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  slug: string,
): PlanReviewResult {
  const tasks = listPlanTasks(cwd, slug);
  const derivedTasks = deriveTasks(cwd, slug);
  const orchestrated = approvePlan(state, tasks, derivedTasks, (currentState, nextTasks) =>
    transition(currentState, "implement" as Phase, nextTasks),
  );

  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

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
  };
}
```

In `extensions/megapowers/plan-orchestrator.ts`, inside `transitionReviewToRevise(state: MegapowersState, approvedIds: number[], needsRevisionIds: number[], maxIterations: number): OrchestratorResult<PlanTransitionResult>`, replace ONLY:
```ts
        nextStep: "Transitioning to revise mode. A new review session will start.",
```
with:
```ts
        nextStep: "Revise mode is active in the current Pi session. Update the tasks using the review feedback.",
```
Do not overwrite the whole file: sequential execution preserves Task 2's correction to `transitionDraftToReview`. This edit targets an independent existing function, so dependency `[depends: 1]` remains valid. Preserve iteration limits, iteration increment, status updates, feedback artifacts, and approve behavior.

In the two existing tests currently titled `sets triggerNewSession flag on revise` and `returns triggerNewSession on approve`, retain their fixtures and other assertions but replace:
```ts
expect(result.triggerNewSession).toBe(true);
```
with:
```ts
expect(result.error).toBeUndefined();
expect(result).not.toHaveProperty("triggerNewSession");
```
Rename those tests to `omits session-reset instructions on revise` and `omits session-reset instructions on approve`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review.test.ts -t "plan-review session policy"`
Expected: PASS. Also run `bun test tests/tool-plan-review.test.ts tests/plan-orchestrator.test.ts` to retain all review/state/gate coverage and unchanged orchestrator behavior.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing.
