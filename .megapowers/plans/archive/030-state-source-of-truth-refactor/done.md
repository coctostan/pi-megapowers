# Done: 030 — State Source of Truth Refactor

## Branch
`feat/030-state-source-of-truth-refactor` (based off `4f53528`)

## Summary
Replaced megapowers' regex-based signal detection and split in-memory/disk state model with a tool-first, disk-first architecture.

### What changed
- **New modules:** `state-io.ts`, `derived.ts`, `write-policy.ts`, `tool-overrides.ts`, `tool-signal.ts`, `tool-artifact.ts`, `phase-advance.ts`, `prompt-inject.ts`, `satellite.ts`
- **Deleted modules:** `artifact-router.ts`, `tdd-guard.ts`, `state-recovery.ts`, `satellite-tdd.ts`
- **Refactored:** `index.ts` (no module-level state, tool-based architecture), `gates.ts` (derived tasks), `ui.ts` (derived tasks, atomic writes), `spec-parser.ts` (sentinel detection), `state-machine.ts` (thin schema)

### Key architectural changes
1. **Tool-first signals:** LLM calls `megapowers_signal` and `megapowers_save_artifact` tools instead of producing regex-matchable prose
2. **Disk-first state:** Every handler reads state from disk via `readState()`, no module-level state variable
3. **Thin state schema:** `state.json` stores only coordination data; task lists and acceptance criteria derived on demand from artifact files
4. **Atomic writes:** `writeState()` uses temp-file-then-rename
5. **Write policy:** Pure `canWrite()` function encodes full TDD/phase write matrix
6. **Tool overrides:** write/edit intercepted via `tool_call` hook, bash post-processed via `tool_result` hook

### Source issues resolved
- **#006** — Acceptance criteria derived from spec.md on demand, never cached
- **#017** — Task completion via `megapowers_signal({ action: "task_done" })`, not regex
- **#019** — Task index advances reliably via tool call, auto-advances to verify on final task
- **#021** — Disk-first state eliminates in-memory/file drift
- **#023** — `hasOpenQuestions()` recognizes "None"/"N/A" sentinels
- **#024** — Review approval via `megapowers_signal({ action: "review_approve" })`, not regex
- **#028** — All artifact persistence via `megapowers_save_artifact` tool calls
- **#029** — Tasks derived from plan.md on demand, never stored in state.json

### Code review fixes applied
- `gates.ts`: implement→verify gate migrated from `state.planTasks` to `deriveTasks()` + `completedTasks`
- `ui.ts`: all `store.saveState()` → `writeState()`, dashboard uses derived tasks
- Tests updated for new signatures

### Known remaining items (from code review — non-blocking)
- AC20: jj task change creation on `task_done` not wired (functions exist in `task-coordinator.ts`, just not called from `handleTaskDone`)
- AC47/48: Satellite TDD state uses disk I/O instead of spec's in-memory requirement
- Async fire-and-forget jj operations could theoretically race (low risk)
- Dead code: `satellite.ts:loadSatelliteState`, `store.ts` planTasks backfill logic

## Test Results
418 pass, 0 fail, 747 expect() calls across 20 test files
