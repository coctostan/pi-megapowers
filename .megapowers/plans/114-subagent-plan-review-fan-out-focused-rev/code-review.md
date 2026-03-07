# Code Review — Issue #114

## Files Reviewed

- `.pi/agents/coverage-reviewer.md` — new project-scoped agent file for AC coverage analysis
- `.pi/agents/dependency-reviewer.md` — new project-scoped agent file for dependency/ordering review
- `.pi/agents/task-quality-reviewer.md` — new project-scoped agent file for per-task TDD quality review
- `extensions/megapowers/plan-review/focused-review.ts` — new: gating helper, plan builder, agent constants
- `extensions/megapowers/plan-review/focused-review-runner.ts` — new: `runFocusedReviewFanout` using `pi-subagents`
- `extensions/megapowers/hooks.ts` — modified: adds `preparePlanReviewContext` called in `onBeforeAgentStart`
- `extensions/megapowers/prompt-inject.ts` — modified: `buildFocusedReviewArtifactsSection` injected into plan-review prompt
- `prompts/review-plan.md` — modified: adds `{{focused_review_artifacts}}` placeholder
- `tests/focused-review.test.ts` — new: unit tests for gating helper and plan builder
- `tests/focused-review-runner.test.ts` — new: integration tests for the runner (all/partial/full failure)
- `tests/hooks-focused-review.test.ts` — new: tests for `preparePlanReviewContext` threshold and soft-fail
- `tests/prompt-inject.test.ts` — modified: tests for focused artifact injection in review prompt

## Strengths

- **Clean separation of concerns** (`focused-review.ts` vs. `focused-review-runner.ts`): pure plan-building logic is separate from I/O, making both easy to unit test without mocking filesystems.
- **Dependency injection pattern** (`FocusedReviewRunnerDeps`): `discoverAgents` and `runSync` are injectable, enabling hermetic tests without touching the real `pi-subagents` runtime.
- **Resilience by design**: `Promise.allSettled` in the runner ensures all three subagents run regardless of individual failures, and the soft-catch in `preparePlanReviewContext` means a total crash never blocks the review session.
- **Agent prompts are well-scoped**: each agent file has a tight scope statement, explicit "You are advisory only" boundary, and a concrete bounded output format — they won't drift into each other's domains.
- **Threshold constant is exported and tested**: `FOCUSED_REVIEW_THRESHOLD = 5` is a named constant used in both the guard and tests, not a magic number.
- **User messaging is precise**: distinct messages for partial failure (names missing artifacts) vs. full failure ("fan-out failed … review proceeded without advisory artifacts") satisfy AC 26–27 exactly.

## Findings

### Critical
None.

### Important

**Fixed — Scoping bug in `prompt-inject.ts` (was line 190)**
The `if (state.planMode === "review")` block setting `vars.focused_review_artifacts` was placed *outside* the closing brace of `if (state.phase === "plan")`. This caused the block to run on every workflow phase, not just plan. While functionally harmless (the template variable is only used in `review-plan.md`, which is only loaded during plan-review mode), it was a correctness hazard: any future phase that happens to retain `planMode === "review"` in state would unnecessarily call `buildFocusedReviewArtifactsSection` and read the filesystem. Fixed by moving the block inside `if (state.phase === "plan")`.

### Minor

**Fixed — Guard condition in `buildFocusedReviewArtifactsSection` (was line 58)**
The early-return guard was `if (taskCount > 0 && !shouldRunFocusedReviewFanout(taskCount))`. When `taskCount === 0`, the `taskCount > 0` operand is false so the guard never fires, causing the function to proceed and emit "Focused review fan-out failed and the review proceeded without advisory artifacts." — even though fan-out never ran. The correct guard is `!shouldRunFocusedReviewFanout(taskCount)` (since `shouldRunFocusedReviewFanout(0)` already returns `false`). Fixed. The test that relied on the old behavior (which deleted the tasks directory to produce taskCount=0) was updated to only delete the artifact files, keeping tasks intact so `taskCount` remains 5.

**Minor — `derivedTasks` computed on all phases (no fix needed)**
The refactor that hoisted `const derivedTasks = deriveTasks(cwd, state.activeIssue)` to the top of `buildInjectedPrompt` means it runs on all phases, not just `implement`. This is a small extra disk read per session start but is harmless given the function is fast and the result is now correctly reused for both implement-phase task vars and plan-phase focused review vars. Not worth reverting.

## Recommendations

- Consider adding a `// Plan phase:` comment label above the focused-review block (lines 189-198) to mirror the existing comment style in the function (`// Done phase:`, `// Learnings + Roadmap:`). The block is now correctly scoped; a comment would make it immediately legible.
- The `preparePlanReviewContext` function is exported from `hooks.ts` for testability, which is good. If it ever needs to be reused outside hooks, consider moving it to the `plan-review/` module alongside `focused-review-runner.ts`.

## Assessment

**ready**

Both bugs (scoping and guard condition) were found and fixed during code review. Tests re-run after fixes: **905 pass, 0 fail**. All 30 acceptance criteria remain satisfied. The implementation is clean, well-tested, and consistent with codebase conventions.
