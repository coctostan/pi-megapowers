# Brainstorm: Pipeline TUI Visibility Panel

## Scope

This issue is narrowed to **rich TUI rendering for the `pipeline` tool** — live visibility into what the pipeline is doing while it runs, with the result persisting inline in the conversation after completion. The structured SubagentResult for the one-shot `subagent` tool was evaluated and deemed YAGNI.

#086 already delivered the structured TypeScript contracts between pipeline steps (ImplementResult, VerifyResult, ReviewResult, PipelineResult), discriminated union return types, and Zod-validated reviewer output. This issue builds the **user-facing visibility layer** on top of that infrastructure.

## Approach

Use pi's built-in tool rendering API (`renderCall`, `renderResult`, `onUpdate`) — the same pattern demonstrated in the pi subagent example extension — to give the `pipeline` tool a rich inline display. This replaces the current behavior where the pipeline runs silently and returns a JSON blob.

The pipeline runner (`runPipeline`) gains an optional `onProgress` callback in `PipelineOptions`. At each step transition (implement start/end, verify start/end, review start/end, retry), the runner calls `onProgress` with a typed `PipelineProgressEvent`. The tool handler in `register-tools.ts` maps this callback to `onUpdate(partial)`, which triggers the TUI to re-render the tool's display. A new `pipeline-renderer.ts` module contains pure functions that convert `PipelineToolDetails` (the structured state accumulated from progress events) into display lines for `renderCall` and `renderResult`.

Usage stats (tokens, cost, model) are extracted from `DispatchResult.messages` (which carry pi's `Message` usage fields) and shown per step plus as totals. The data is already available — just needs extraction and formatting.

The panel stays visible after completion as an inline tool result in the conversation. Ctrl+O toggles collapsed/expanded views following the pi subagent example pattern.

## Key Decisions

- **Tool rendering API over `setWidget`** — Using `renderCall`/`renderResult`/`onUpdate` keeps the display inline in the conversation flow. No widget lifecycle management needed. Collapsed/expanded support is built-in via Ctrl+O.
- **`onProgress` callback injected into `PipelineOptions`** — Keeps the runner pure and testable. Tests pass a spy callback; the tool handler maps it to `onUpdate`. No UI dependency in the runner.
- **Usage stats per step + totals** — Data is already in `DispatchResult.messages`. Shows tokens, cost, model for implement and review steps. Verify is a shell command so no LLM usage.
- **Panel persists after completion** — Tool results naturally stay in the conversation. Cleared only when content scrolls off.
- **Pure renderer functions** — `renderPipelineCall(args, theme)` and `renderPipelineResult(details, expanded, theme)` are pure functions from data → string[]. Fully testable without TUI.
- **Structured `PipelineToolDetails`** — Accumulates progress events into a single typed object that the renderer consumes. Contains: taskIndex, taskTitle, pipelineId, status, steps (with per-step status, timing, usage, filesChanged, testOutput, verdict, findings), totals, error info.

## Components

### 1. `PipelineProgressEvent` type (in `pipeline-runner.ts` or new types file)
Discriminated union of step events:
- `{ step: "implement" | "verify" | "review", status: "running" | "done" | "failed", durationMs?, ... }`
- `{ step: "retry", count: number, reason: string }`

### 2. `onProgress` callback wiring (in `pipeline-runner.ts`)
Calls at: step start, step end, retry. Pure — no side effects beyond the callback.

### 3. `PipelineToolDetails` type (new `pipeline-renderer.ts`)
Structured state object accumulated from progress events. Contains everything the renderer needs.

### 4. `renderPipelineCall` / `renderPipelineResult` (new `pipeline-renderer.ts`)
Pure functions: `(details, expanded?, theme?) → string[]`. Handle:
- Running state: step-by-step with spinner on active step
- Completed state: all steps with checkmarks, timing, usage totals
- Failed/paused state: error info, retry count
- Collapsed vs expanded views

### 5. `extractUsageStats` (new `pipeline-renderer.ts` or utility)
Extracts tokens, cost, model from `Message[]` usage fields.

### 6. Tool registration update (in `register-tools.ts`)
Wire `renderCall`, `renderResult`, and map `onProgress` → `onUpdate` for the `pipeline` tool. Same for `subagent` (one-shot) tool if time permits.

## Testing Strategy

- **`PipelineProgressEvent` emission** — Unit tests on `runPipeline` with a spy `onProgress` callback. Assert correct events at correct times (step start/end, retry). Already have mock dispatcher/shell patterns from #086.
- **`PipelineToolDetails` accumulation** — Unit tests: feed a sequence of progress events, assert the accumulated details object has correct state.
- **Renderer functions** — Unit tests: `renderPipelineCall(args, theme) → string[]` and `renderPipelineResult(details, expanded, theme) → string[]`. Assert output contains expected icons, timing, usage stats. Test collapsed vs expanded. Test all states: running, completed, paused, failed.
- **`extractUsageStats`** — Unit test: pass mock `Message[]` with usage fields, assert correct totals.
- **Integration** — The tool registration wiring (`register-tools.ts`) is thin glue that maps callbacks. Not unit-testable without pi runtime, but covered by manual verification.
