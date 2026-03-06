# Brainstorm: Two-Tier Plan Validation

## Problem

The plan review loop is the biggest workflow bottleneck. Each review iteration requires a session break (expensive, slow), and the deep reviewer wastes cycles catching trivial mechanical errors — empty descriptions, placeholder text, missing file targets — that could be caught deterministically or with a fast model. This means more iterations than necessary, and each iteration is slower than it needs to be.

## Approach

Plan validation is split into three tiers that progressively filter issues:

**T0 (deterministic, per-task)** runs inside the `megapowers_plan_task` tool handler every time a task is created or updated. It uses pure structural checks — string length, array emptiness, set lookups, substring checks — with no regex. If a task fails T0, the tool returns an error immediately and the task is not saved. The drafter fixes inline and retries. No state change, no session break.

**T1 (fast model, at submission)** runs inside `handlePlanDraftDone` when the drafter signals the draft is complete. It assembles the full plan + spec context, calls a high-quality zero-thinking model (Sonnet 4.6 or GPT-5.3 Codex with thinking disabled) via `@mariozechner/pi-ai`'s `complete()` function, and checks cross-plan coherence: spec coverage, dependency sanity, task descriptions being substantive vs. hand-wavy, file path plausibility. If T1 finds issues, the tool returns them as an error — no state transition, no session break. The drafter fixes tasks with `megapowers_plan_task` and retries `plan_draft_done`.

**T2 (deep reviewer, existing session break)** is the existing plan review flow. By the time T2 runs, all mechanical and coherence issues are already resolved. T2 focuses exclusively on high-value questions: is the approach sound, are the abstractions right, will this actually work when implemented, is the task decomposition the right granularity.

The net effect: fewer total review iterations, and each iteration is faster because T2 isn't wasting time on easy stuff.

## Key Decisions

- **T0 runs per-task, not at submission** — catches errors at the source, prevents accumulation of the same mistake across 8 tasks
- **No regex in T0** — all checks use simple structural operations (string length, `includes()`, array emptiness, numeric comparisons, Set lookups) to avoid false positives and fragility
- **T1 uses `@mariozechner/pi-ai` directly, not `pi-subagents`** — a single `complete()` call is simpler, faster (~2-5 seconds), and avoids process spawning overhead
- **T1 model: Sonnet 4.6 or GPT-5.3 Codex with thinking off** — fast, high-quality, cheap; configurable for model availability
- **T1 completeFn injected as a dependency** — following the project's established pattern (like `execJJ` injection), the LLM call function is a parameter so tests can pass a mock without real API keys
- **Both T0 and T1 return errors without state changes** — the tool handler returns an error string, the drafter fixes and retries. No new state machine states needed.
- **Graceful degradation** — if the user doesn't have an API key for the T1 model, skip T1 with a warning and proceed to T2
- **T2 review prompt can be narrowed** — since T0/T1 handle mechanical checks, the T2 prompt can drop those concerns and focus on architecture/approach/correctness

## Components

1. **`plan-task-linter.ts`** — Pure function: `lintTask(task: PlanTask, existingTasks: PlanTask[]): LintResult`. Runs T0 deterministic checks. Returns `{ pass: true }` or `{ pass: false, errors: string[] }`.

2. **`plan-lint-model.ts`** — Async function: `lintPlanWithModel(tasks, spec, completeFn): Promise<LintResult>`. Builds a targeted prompt from the full plan + spec, calls the fast model, parses the response. Returns pass/fail with findings.

3. **`lint-plan-prompt.md`** — New prompt template for T1. Focused checklist: spec coverage, cross-task coherence, description quality, file path plausibility. Instructs the model to return structured pass/fail with specific findings.

4. **Modified `tool-plan-task.ts`** — Calls `lintTask()` before saving. Returns error if lint fails.

5. **Modified `tool-signal.ts` (`handlePlanDraftDone`)** — Becomes async. After the existing "has tasks?" check, calls `lintPlanWithModel()`. Only transitions to review mode if T1 passes.

6. **Modified `review-plan.md`** — Updated T2 prompt to drop mechanical checks and focus on architecture/approach/correctness concerns.

## Testing Strategy

- **`plan-task-linter.test.ts`** — Unit tests for every T0 check: empty title, short description, missing file targets, invalid dependency refs, duplicate file targets across tasks. Pure functions, no mocks needed.
- **`plan-lint-model.test.ts`** — Unit tests with injected mock `completeFn`. Tests prompt assembly, response parsing (pass, fail with findings, malformed response handling, API error handling). No real LLM calls.
- **`tool-plan-task.test.ts`** — Integration tests verifying that T0 lint failures prevent task saves and return clear error messages.
- **`tool-signal.test.ts`** — Integration tests for `handlePlanDraftDone` verifying: T1 failure blocks state transition, T1 pass allows transition, graceful degradation when no API key available.
- **Prompt testing** — The T1 prompt itself is tested indirectly through the mock `completeFn` tests (verifying the assembled prompt contains the right sections). Real model validation deferred to manual testing.
