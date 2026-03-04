# Spec: Pipeline TUI Visibility Panel

## Goal

Add rich TUI rendering to the `pipeline` tool so users can see live step-by-step progress (implement → verify → review) while the pipeline runs, with usage stats (tokens, cost, model) per step, timing, and a persistent inline result after completion. This replaces the current silent-run-then-JSON-blob behavior by wiring pi's built-in tool rendering API (`renderCall`, `renderResult`, `onUpdate`) and adding an `onProgress` callback to the pipeline runner.

## Acceptance Criteria

1. `PipelineOptions` accepts an optional `onProgress` callback of type `(event: PipelineProgressEvent) => void`.

2. `PipelineProgressEvent` is a discriminated union with events for: step start (`{ type: "step-start", step: "implement" | "verify" | "review" }`), step end (`{ type: "step-end", step: "implement" | "verify" | "review", durationMs: number, error?: string }`), and retry (`{ type: "retry", retryCount: number, reason: string }`).

3. `runPipeline` calls `onProgress` with a `step-start` event before each step begins and a `step-end` event after each step completes or fails.

4. `runPipeline` calls `onProgress` with a `retry` event each time a retry cycle begins, including the retry count and failure reason.

5. When no `onProgress` callback is provided, `runPipeline` behavior is unchanged from its current implementation (no errors, no side effects).

6. A `PipelineToolDetails` type exists that accumulates pipeline state: `taskIndex`, `taskTitle`, `pipelineId`, `status` (`"running" | "completed" | "paused" | "failed"`), an array of step entries (each with step name, status, durationMs, error), `retryCount`, and `usageStats` (per-step and totals).

7. A pure function `buildPipelineDetails(events: PipelineProgressEvent[], meta: { taskIndex: number, taskTitle: string, pipelineId: string }) → PipelineToolDetails` accumulates a sequence of progress events into a `PipelineToolDetails` object.

8. `extractUsageStats(messages: Message[]) → UsageStats` extracts aggregate token counts (input, output, cacheRead, cacheWrite), cost, and model from a `Message[]` array, using the same `msg.usage` fields as the pi subagent example.

9. A `renderPipelineCall(args: { taskIndex: number, resume?: boolean, guidance?: string }, theme) → Text` function returns a styled `Text` TUI element showing the pipeline invocation (task index, resume/guidance info).

10. A `renderPipelineResult(result: AgentToolResult<PipelineToolDetails>, options: { expanded: boolean, isPartial: boolean }, theme) → Text | Container` function returns a styled TUI element. When `isPartial` is true, it shows the current running state with step progress indicators.

11. `renderPipelineResult` in collapsed mode (expanded=false) shows a one-line summary: status icon (✓/✗/⏸), step count, total duration, and total cost.

12. `renderPipelineResult` in expanded mode (expanded=true) shows all steps with individual status icons, step names, durations, errors (if any), retry count, usage stats per LLM step (implement, review), and total usage stats.

13. The `pipeline` tool registration in `register-tools.ts` includes `renderCall` and `renderResult` properties that delegate to the pure renderer functions.

14. The `pipeline` tool registration maps `onProgress` events from the runner to `onUpdate(partial)` calls, updating the `PipelineToolDetails` in the partial result so the TUI re-renders on each step transition.

15. All renderer functions (`renderPipelineCall`, `renderPipelineResult`, `buildPipelineDetails`, `extractUsageStats`) are pure — they take data in and return values with no side effects, and are importable from a `pipeline-renderer.ts` module.

16. `step-end` events for `implement` and `review` steps include a `messages: Message[]` field so usage stats can be extracted per-step.

## Out of Scope

- Structured TUI rendering for the one-shot `subagent` tool (evaluated and deferred as YAGNI).
- Modifying the pipeline runner's retry logic, step ordering, or result types.
- Widget-based rendering (`setWidget`) — this uses inline tool rendering only.
- Real-time streaming of subagent output within a step (progress fires on step boundaries only).
- Persisting usage stats to disk or pipeline logs.
- Changes to `PipelineResult` return type from `runPipeline`.

## Open Questions

*(none)*
