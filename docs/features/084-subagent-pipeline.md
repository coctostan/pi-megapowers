# Feature: Subagent Pipeline (#084)

## Overview

A two-layer subagent orchestration system built on top of `pi-subagents` (npm dependency). The first layer is an **implementation pipeline** that autonomously runs implement → verify → review steps for each plan task in an isolated jj workspace, with retry budgets and escalation to the parent LLM on failure. The second layer is a **one-shot subagent tool** for ad-hoc delegation.

TDD enforcement shifts from the previous in-memory write-blocking approach to a **prompt-based + deterministic audit model**: a TDD auditor analyzes the implementer's tool-call history after the implement step and feeds a compliance report to the reviewer as a soft gate.

---

## Architecture

### Layer 1: Implementation Pipeline (`pipeline` tool)

The `pipeline` tool dispatches a full implement → verify → review cycle for a specific plan task. Each step runs as a pi-subagent in an isolated jj workspace.

```
pipeline { taskIndex }
  │
  ▼
createPipelineWorkspace()          ← isolated jj workspace
  │
  ▼  [cycle, up to maxRetries]
  ├─ implementer agent             ← TDD-guided implementation
  │    └─ auditTddCompliance()     ← deterministic ordering check
  ├─ verifier agent                ← bun test, reports pass/fail
  └─ reviewer agent                ← reads spec + TDD report, approve/reject
  │
  ├─ completed → squashPipelineWorkspace() + task_done
  └─ paused    → writePipelineMeta() + return log/diff/errorSummary to LLM
```

**Resume flow:** When a pipeline pauses (budget exhausted), the parent LLM can call
`pipeline { taskIndex, resume: true, guidance: "..." }` with actionable guidance.
The pipeline reuses the existing workspace — no new workspace is created.

### Layer 2: One-Shot Subagent (`subagent` tool)

For ad-hoc tasks not tied to a plan task. Dispatches a single agent, squashes changes back on success, and surfaces squash/cleanup errors explicitly.

---

## New Files

### `extensions/megapowers/subagent/`

| File | Responsibility |
|------|---------------|
| `dispatcher.ts` | `Dispatcher` interface, `DispatchConfig`, `DispatchResult` types |
| `pi-subagents-dispatcher.ts` | `PiSubagentsDispatcher` — wraps pi-subagents' `runSync`, maps config overrides |
| `message-utils.ts` | `extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`, `extractTestOutput` |
| `pipeline-results.ts` | `parseStepResult`, `parseReviewVerdict` |
| `pipeline-context.ts` | `buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt` |
| `tdd-auditor.ts` | `auditTddCompliance` — deterministic TDD ordering check from tool-call history |
| `pipeline-log.ts` | JSONL log writer/reader per pipeline |
| `pipeline-workspace.ts` | `createPipelineWorkspace`, `squashPipelineWorkspace`, `cleanupPipelineWorkspace`, `getWorkspaceDiff` |
| `pipeline-meta.ts` | Resume metadata store (paused pipeline state) |
| `pipeline-runner.ts` | `runPipeline` — implement→verify→review with retries, context carry-forward |
| `pipeline-tool.ts` | `handlePipelineTool` — LLM-facing entrypoint: validation, dispatch, squash, task_done |
| `oneshot-tool.ts` | `handleOneshotTool` — one-shot subagent dispatch |
| `task-deps.ts` | `validateTaskDependencies` — dependency check before pipeline dispatch |

### Agent Definitions (`.pi/agents/`)

| File | Agent | Model |
|------|-------|-------|
| `implementer.md` | TDD-guided implementer | openai/gpt-5.3-codex |
| `verifier.md` | Test runner (bun test only) | anthropic/claude-haiku-4-5 |
| `reviewer.md` | Code reviewer with structured verdict | anthropic/claude-sonnet-4-5 |

### Modified Files

- `extensions/megapowers/register-tools.ts` — replaced old `subagent`/`subagent_status` wiring with new `subagent` (one-shot) and `pipeline` tools
- `extensions/megapowers/satellite.ts` — `PI_SUBAGENT_DEPTH` detection, `resolveProjectRoot()` walk-up, no-op `setupSatellite()` (satellite sessions no longer install write-blocking hooks)
- `extensions/megapowers/commands.ts` — `/mega off` / `/mega on` tool filtering updated: `pipeline` added, `subagent_status` removed
- `package.json` — `pi-subagents: ^0.11.0` added as dependency

### Deleted Files (Clean Slate)

All `extensions/megapowers/subagent/subagent-*.ts` (9 source files) and corresponding `tests/subagent-*.test.ts` (9 test files) replaced wholesale with the new pipeline implementation.

---

## Key Design Decisions

### Dispatcher Interface
`PiSubagentsDispatcher` depends on a `RunSyncFn` injected via constructor — all tests use a mock dispatcher. No integration tests run actual pi-subagents agents (declared out of scope for v1).

### TDD Enforcement — Soft Gate
The legacy hard write-block is replaced by:
1. **Implementer prompt** — explicit TDD instructions (write test → confirm fail → implement → confirm pass)
2. **Deterministic post-hoc audit** (`auditTddCompliance`) — inspects tool-call history, produces `{ testWrittenFirst, testRanBeforeProduction, productionFilesBeforeTest, testRunCount }`
3. **Reviewer soft gate** — compliance report included in review context; reviewer decides whether non-compliance warrants rejection

### Pipeline Completion and TDD Gate Bypass
`setSkippedTddStateForTask()` writes a `skipped` TDD task state before invoking `task_done`, preventing the primary session's hard TDD gate from blocking completion. The pipeline already enforced TDD via verifier + reviewer + audit report.

### Retry Budget
- Default: 3 cycles; configurable via `maxRetries`
- Verify failure → re-run implement → verify
- Review rejection → re-run implement → verify → review
- Review step execution failure (timeout/crash) → treated as failure, not as rejection; retry with error in context
- Step timeout counted via `AbortSignal.timeout()` in `PiSubagentsDispatcher`

### Context Carry-Forward
`PipelineContext` is immutable; each step produces a new context via `appendStepOutput` / `setRetryContext`. Review findings accumulate in `accumulatedReviewFindings`. `renderContextPrompt()` renders the full context as structured markdown sections.

### jj Workspace Isolation
Each pipeline creates a `mega-{pipelineId}@` workspace at `.megapowers/subagents/{pipelineId}/workspace`. On success: `jj squash --from mega-{id}@` + `jj workspace forget`. On failure/abort: `jj workspace forget` + `rmSync`.

### Satellite Compatibility
`isSatelliteMode()` now recognizes `PI_SUBAGENT_DEPTH=N` (set by pi-subagents) in addition to legacy `PI_SUBAGENT=1`. `resolveProjectRoot()` walks up from the workspace cwd to find `.megapowers/state.json`. `setupSatellite()` is a no-op — satellite sessions don't install write-blocking hooks.

---

## Test Coverage

14 new test files, 601 total tests (up from 546 before this feature). All tests are pure (no actual pi-subagents or jj invocations).

---

## Limitations / Out of Scope (v1)

- Parallel pipeline execution (one at a time)
- Integration tests with actual pi-subagents agents
- TUI / management layer from pi-subagents
- Automatic pipeline dispatch on entering implement phase
- Chain execution (deferred to pi-subagents native support)
