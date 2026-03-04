# Code Review: Pipeline TUI Visibility Panel (#074)

## Files Reviewed

- `extensions/megapowers/subagent/pipeline-renderer.ts` — New module: `PipelineProgressEvent`, `PipelineToolDetails`, `UsageStats`, `StepEntry` types; `extractUsageStats`, `buildPipelineDetails`, `renderPipelineCall`, `renderPipelineResult`, and formatting helpers
- `extensions/megapowers/subagent/pipeline-runner.ts` — Added `onProgress` to `PipelineOptions`; wired `step-start`, `step-end`, and `retry` events throughout the pipeline loop
- `extensions/megapowers/subagent/pipeline-tool.ts` — Added `onProgress` parameter forwarded into `runPipeline`
- `extensions/megapowers/register-tools.ts` — Wired `renderCall`/`renderResult` on the `pipeline` tool; mapped runner `onProgress` events to `onUpdate` partial updates
- `tests/pipeline-renderer.test.ts` — New test file: type shape tests, `extractUsageStats`, `buildPipelineDetails`, renderer tests, purity tests
- `tests/pipeline-runner.test.ts` — Extended with progress event tests (step-start/end, retry, omitted callback, messages in step-end)
- `tests/register-tools.test.ts` — Extended with `renderCall`/`renderResult` presence test, `onProgress` wiring test
- `tests/pipeline-tool.test.ts` — Extended with `onProgress` passthrough test

## Strengths

- **Clean separation of concerns** — `pipeline-renderer.ts` is a pure data-in/value-out module with no side effects, making it easy to test and reason about. All rendering logic lives here, separate from the runner and tool wiring.
- **Discriminated union design** (`PipelineProgressEvent`) is idiomatic TypeScript and enables exhaustive handling (`type === "step-start"`, `"step-end"`, `"retry"`) throughout.
- **Optional chaining throughout the runner** (`onProgress?.(...)`) — the runner never throws if the callback is absent; behavior is identical to pre-feature (criterion 5 honoured without extra guard code).
- **`messages` field on step-end events** carries the full message array from the dispatcher result, enabling accurate per-step usage extraction without requiring the runner to understand usage stats itself.
- **Graceful fallback in `renderPipelineResult`** (line 186–189) — when `details` is absent (e.g., error before first event), the raw text content is rendered rather than crashing.
- **Format helpers** (`formatDuration`, `formatCost`, `formatTokens`, `formatUsageOneLiner`) are small, well-named pure functions — easy to unit test independently.
- **`renderPartialPipeline`** conveys meaningful mid-run state (which step is running, how many completed, retry count) without needing the full expanded renderer.

## Findings

### Critical

None.

### Important

**1. `perStep` stats overwritten instead of accumulated across retries** *(fixed)*
- **File:** `extensions/megapowers/subagent/pipeline-renderer.ts:95` (pre-fix)
- **What:** When a retry occurred, `steps` was reset but `perStep` was not. On the second run of `implement`, `perStep["implement"]` was overwritten with only the last run's stats, while `totalUsage` correctly accumulated both runs. The expanded view showed `perStep.implement.input = 80` while `total.input = 180` — inconsistent data presented to the user.
- **Why it matters:** Users relying on the expanded view to understand costs per step would see misleading figures after any retry. The total was correct but per-step was silently wrong.
- **Fix applied:** `perStep[step]` now accumulates across all runs (add to previous if it exists), keeping it consistent with `totalUsage`. New test `"accumulates perStep stats across retries..."` in `tests/pipeline-renderer.test.ts` covers this case.

**2. Dead `else if` branch in `buildPipelineDetails` status inference** *(fixed)*
- **File:** `extensions/megapowers/subagent/pipeline-renderer.ts:117–119` (pre-fix)
- **What:** `else if (steps.some(s => s.status === "failed")) { status = "running"; }` — `status` defaults to `"running"` and this branch set it to the same value. It was a complete no-op, but it looked intentional.
- **Why it matters:** Misleads maintainers into thinking there's a meaningful distinction being made (e.g., future developers might try to change it to `"failed"`, not realising the status is overridden externally).
- **Fix applied:** Branch removed. The default `"running"` already covers this case.

**3. Dead `r.result?.status === "failed"` branch in `register-tools.ts`** *(fixed)*
- **File:** `extensions/megapowers/register-tools.ts:252` (pre-fix)
- **What:** `PipelineStatus` is typed `"completed" | "paused"`. The third `else if` branch checking for `"failed"` was unreachable by construction.
- **Why it matters:** Dead code misleads future developers who may assume `"failed"` is a real pipeline outcome and branch on it elsewhere.
- **Fix applied:** Branch removed. The two live branches (`"completed"`, `"paused"`) remain.

### Minor

**4. `messages as any[]` cast in `extractUsageStats`**
- **File:** `extensions/megapowers/subagent/pipeline-renderer.ts:55`
- **What:** `for (const msg of messages as any[])` bypasses TypeScript to access `msg.usage` and `msg.model` which aren't on the public `Message` type.
- **Why it matters:** Low risk since the cast is local and the test exercises real message shapes, but it's an escape hatch that won't catch changes to the internal message structure at compile time.
- **Suggestion:** Define a minimal internal interface `{ role: string; model?: string; usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; cost?: { total?: number } } }` and cast to that instead of `any[]`.

**5. `void onUpdate(...)` discards promise silently**
- **File:** `extensions/megapowers/register-tools.ts:227`
- **What:** `void onUpdate({ content, details })` fires-and-forgets. If `onUpdate` rejects asynchronously the error is swallowed.
- **Why it matters:** In practice `onUpdate` is a TUI re-render helper unlikely to throw, and blocking `onProgress` on the promise would slow down the runner. Risk is low but worth noting.
- **Suggestion:** Add `.catch(console.error)` or a no-op catch to make the intent explicit.

**6. Status icon mapping duplicated between collapsed and expanded renderers**
- **File:** `extensions/megapowers/subagent/pipeline-renderer.ts:224–231`, `250–257`
- **What:** The four-way `status → icon` mapping is copy-pasted into both `renderCollapsedPipeline` and `renderExpandedPipeline`.
- **Why it matters:** A future status value or icon change must be updated in two places.
- **Suggestion:** Extract `getStatusIcon(status, theme)` as a small helper.

**7. Behavioral test coverage for `onProgress → onUpdate` wiring is source-inspection only**
- **File:** `tests/register-tools.test.ts:60–66`, `tests/pipeline-tool.test.ts:250–255`
- **What:** Both tests check that the source text of the implementation *contains* the string `"onProgress"` / `"onUpdate"` / `"buildPipelineDetails"`. They pass even if the wiring is broken.
- **Why it matters:** A refactor that renames a variable would break the feature silently while these tests still pass.
- **Suggestion:** Replace with a lightweight behavioral test that stubs `handlePipelineTool` and confirms `onUpdate` is called with a partial `PipelineToolDetails` during execution.

## Recommendations

- **Extract `getStatusIcon`** (minor #6 above) — 5-line helper that eliminates the duplication.
- **Consider a typed usage accessor** rather than `as any[]` — the internal shape is stable enough to define a narrow interface.
- **Behavioral integration test for the `onUpdate` path** — the existing source-inspection tests pass regardless of correctness; a proper stub-based test would give real confidence in criterion 14.

## Fixes Applied in This Session

| # | File | Change |
|---|------|--------|
| Important #1 | `pipeline-renderer.ts` | Accumulate `perStep` stats across retries instead of overwriting |
| Important #2 | `pipeline-renderer.ts` | Remove dead `else if` in status inference |
| Important #3 | `register-tools.ts` | Remove dead `r.result?.status === "failed"` branch |
| New test | `tests/pipeline-renderer.test.ts` | Added `"accumulates perStep stats across retries..."` covering fix #1 |

Post-fix test run: **823 pass / 0 fail** (was 822 before the new test).

## Assessment

**ready**

All spec criteria are met. The three Important findings (two dead branches + the perStep accumulation bug) have been fixed and tested. Remaining Minor items are style/robustness improvements that can be addressed in follow-up work without blocking the merge.
