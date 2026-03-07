# Focused plan-review fan-out via pi-subagents

**Issue:** #114 (batch: #103, #104, #105)  
**Type:** feature  
**Status:** shipped

## What was built

When a plan has 5 or more tasks, Megapowers now runs three focused advisory reviewers in parallel before the main plan-review session begins. Each reviewer is a project-scoped pi agent that writes a bounded artifact to the plan directory. The main reviewer reads those artifacts as advisory context and still owns the final approve/revise decision.

### New agent files

| File | Purpose |
|------|---------|
| `.pi/agents/coverage-reviewer.md` | Analyzes which acceptance criteria each task covers; outputs `coverage-review.md` with AC-by-AC findings |
| `.pi/agents/dependency-reviewer.md` | Inspects task ordering, forward references, hidden prerequisites, and sequencing hazards; outputs `dependency-review.md` |
| `.pi/agents/task-quality-reviewer.md` | Checks per-task TDD completeness, realistic commands/paths/APIs, and self-containment; outputs `task-quality-review.md` |

All three agents are explicitly advisory only — none may call `megapowers_plan_review`, `megapowers_plan_task`, or `megapowers_signal`.

### New source modules

**`extensions/megapowers/plan-review/focused-review.ts`**
- `FOCUSED_REVIEW_THRESHOLD = 5` — exported constant
- `FOCUSED_REVIEW_AGENTS` — typed tuple of the three agent names
- `shouldRunFocusedReviewFanout(taskCount)` — pure gating helper
- `buildFocusedReviewFanoutPlan(params)` — builds a `pi-subagents` parallel task plan with per-agent artifact paths and issue-scoped task strings

**`extensions/megapowers/plan-review/focused-review-runner.ts`**
- `runFocusedReviewFanout(params, deps?)` — runs all three reviewers via `pi-subagents`'s `discoverAgents` + `runSync` using `Promise.allSettled` (never throws)
- Returns a result with `availableArtifacts`, `unavailableArtifacts`, and a user-facing `message` that explicitly names missing artifacts or declares full failure
- Dependency-injectable for testing (`discoverAgents` and `runSync` can be replaced with stubs)

### Modified files

**`extensions/megapowers/hooks.ts`**
- New exported `preparePlanReviewContext(cwd, runFn?)` — reads state, checks phase/planMode/threshold, invokes fan-out, and soft-catches all errors so review never blocks
- Called at the top of `onBeforeAgentStart` so artifacts land on disk before the review prompt is built

**`extensions/megapowers/prompt-inject.ts`**
- New `buildFocusedReviewArtifactsSection(cwd, issueSlug, taskCount)` — reads available artifacts and formats them as an inline advisory section
- Injects `vars.focused_review_artifacts` inside the `if (state.phase === "plan")` block (review mode only)
- Includes explicit authority reminder: "artifact availability does not change which session may call `megapowers_plan_review`"
- Partial failure: names missing artifacts by filename
- Full failure: states "fan-out failed and the review proceeded without advisory artifacts"

**`prompts/review-plan.md`**
- Added `{{focused_review_artifacts}}` placeholder after the task-file reading instructions

## Design decisions

- **Threshold at 5:** simple, deterministic, no heuristics. Plans under 5 tasks skip fan-out entirely — zero behavioral change for small plans.
- **`pi-subagents` not Megapowers subagent:** reuses the existing extension runtime rather than adding a parallel execution mechanism to Megapowers itself.
- **Soft-fail everywhere:** `Promise.allSettled` in the runner, try-catch in `preparePlanReviewContext`, and artifact presence checks in the prompt builder — missing artifacts never block review.
- **Authority boundary in agent prompts and prompt context:** both the agent files and the injected section state explicitly that the main session owns the verdict.

## Test coverage

- `tests/focused-review.test.ts` — gating helper, plan builder, bugfix vs feature workflow
- `tests/focused-review-runner.test.ts` — all-success, partial-failure, full-failure paths
- `tests/hooks-focused-review.test.ts` — threshold gate (< 5 skips), invocation params, soft-fail on throw
- `tests/prompt-inject.test.ts` — artifact injection, partial/full failure messaging, no-op for small plans
