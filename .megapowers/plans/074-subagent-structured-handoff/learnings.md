# Learnings — #074 Pipeline TUI Visibility Panel

- **Pure event-log accumulation beats mutable state for live TUI details.** `buildPipelineDetails` replays the full event array on every call. This makes it a zero-dependency pure function that's trivially testable and correct by construction — no synchronization needed between the progress callback and the renderer.

- **perStep stats must accumulate (not overwrite) when steps repeat across retries.** The original implementation set `perStep[step] = stats` on each `step-end`, silently overwriting earlier runs. `totalUsage` was additive, creating an inconsistency only visible when a retry actually occurred. The fix is to mirror the accumulation pattern: `perStep[step] = prev ? merge(prev, stats) : stats`. Lesson: any time a step can run more than once, overwrite semantics for per-step aggregates are wrong.

- **Dead branches in state inference are a maintenance hazard.** The `else if (steps.some(s => s.status === "failed")) { status = "running"; }` no-op looked intentional — a reader would spend time trying to understand what it was meant to differentiate. Similarly, the `r.result?.status === "failed"` branch was typed out of existence by `PipelineStatus = "completed" | "paused"`. When TypeScript's type system makes a branch unreachable, remove it — don't leave it as "documentation."

- **Source-inspection tests (checking for string tokens in source files) are weak.** Both the `onProgress → onUpdate` wiring test and the `handlePipelineTool passes onProgress` test pass even if the wiring is broken — they only verify that certain identifier names appear in the source text. A proper stub-based behavioral test (inject a mock `onUpdate`, run the tool, assert it was called with the right shape) would give real confidence. Source-inspection tests are acceptable for structural constraints (e.g., "does this file use `.ok` everywhere?") but not for behavioral wiring.

- **`void promise` is fine for fire-and-forget TUI updates, but name the intent.** `void onUpdate(...)` in `register-tools.ts` is intentional — blocking `onProgress` on the TUI re-render promise would stall the pipeline. A comment or `.catch(console.error)` would make the intent explicit and avoid swallowed errors silently.

- **Status icons that appear in two render modes should live in a helper.** `getStatusIcon(status, theme)` would eliminate the four-way mapping duplicated between `renderCollapsedPipeline` and `renderExpandedPipeline`. Small helpers like this cost one line to extract but prevent divergence when adding new status values.

- **TDD red-green discipline catches accumulation bugs that tests-passing-first would miss.** The perStep accumulation bug wasn't covered by any existing test — it only manifested in the retry+messages scenario. Writing the failing test first exposed the bug clearly (`Expected: 180, Received: 80`) and constrained the fix to exactly what was needed.
