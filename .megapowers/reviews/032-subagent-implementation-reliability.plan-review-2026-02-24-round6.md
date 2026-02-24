# Plan Review (Round 6) — Issue 032: Subagent Implementation Reliability

**Reviewed file:** `.megapowers/plans/032-subagent-implementation-reliability/plan.md` (recovered from `fb52f77` — had been truncated to summary-only in `a5f0df8`)

---

## 0) Recovery note

The plan artifact was truncated from 2995 lines to ~15 lines in the most recent commit. Restored from git history (`fb52f77`) with the AC5 confirmation note preserved.

---

## 1) Coverage

All 21 ACs are addressed. Verified against the coverage table at the bottom of the plan:

| AC | Status | Notes |
|----|--------|-------|
| AC1–AC2 | ✅ | Tasks 11, 13 |
| AC3 | ✅ | Tasks 6, 13 |
| AC4 | ✅ | Tasks 8, 13 |
| AC5 | ✅ | Tasks 4, 8, 13 — supervisor-written status, confirmed interpretation |
| AC6 | ✅ | Tasks 4, 11, 13 — returns JSON |
| AC7 | ✅ | Tasks 6, 13 — both `jj diff --summary` AND `jj diff` (full patch, >100KB → file) |
| AC8 | ✅ | Task 11 no-auto-squash test |
| AC9 | ✅ | Tasks 6, 13 — cleanup in close handler |
| AC10 | ✅ | Tasks 8, 13 |
| AC11 | ✅ | Tasks 10, 13 — SIGTERM→SIGKILL escalation |
| AC12 | ✅ | Tasks 1, 3 |
| AC13 | ✅ | Task 2 |
| AC14 | ✅ | Task 1 |
| AC15 | ✅ | Task 13 all-phases test |
| AC16 | ✅ | Tasks 8, 12, 13 — MEGA_PROJECT_ROOT + resolveProjectRoot |
| AC17 | ✅ | Pre-existing in plan-parser.ts (verified) |
| AC18 | ✅ | Tasks 9, 11 |
| AC19 | ✅ | Tasks 7, 11 |
| AC20 | ✅ | Tasks 5, 8, 13 — both tool results AND assistant message text |
| AC21 | ✅ | Task 15 |

No coverage gaps.

---

## 2) Ordering

Dependencies are correctly declared and respected. All `[depends: ...]` annotations checked:

- Task 3 [depends: 1, 2] ✅ — needs parser + builtin files
- Task 8 [depends: 4, 5] ✅ — needs status types + error detection
- Task 9 (no deps) ✅ — pure validation, only needs PlanTask type
- Task 11 [depends: 3, 4, 7, 8, 9, 10] ✅ — correct, uses all of them
- Task 12 [depends: 8] ✅ — needs buildSpawnEnv
- Task 13 [depends: 6, 8, 11, 12] ✅ — the big wiring task, needs everything
- Task 14 [depends: 13] ✅ — mega off/on for subagent tools

No ordering issues.

---

## 3) Completeness

### A) Minor: `RunnerState.timedOut` not in Task 8 interface (noted but not implemented)

Task 8 defines `RunnerState` without `timedOut`. Task 13 uses `runnerState.timedOut = true` and checks `if (runnerState.timedOut)`. The fix is mentioned only as a note at the bottom of Task 13:

> "Note on `RunnerState.timedOut`: add `timedOut?: boolean` to `RunnerState` interface and initialize to `false` in `createRunnerState()`."

**Impact:** Low — TDD will catch the compile error immediately when implementing Task 13. But it would be cleaner if Task 8 included the field in its interface definition.

**Recommendation:** Non-blocking. The implementer will hit this in Task 13 and the note tells them exactly what to do.

### B) Verified: `pi.exec()` supports `{ cwd }` ✅

Previous Round 4 flagged uncertainty about `pi.exec()` accepting `ExecOptions`. Confirmed from the SDK types:

```typescript
// dist/core/extensions/types.d.ts
exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;

// dist/core/exec.d.ts
export interface ExecOptions {
    signal?: AbortSignal;
    timeout?: number;
    cwd?: string;  // ← supported
}
```

Task 13's `pi.exec("jj", args, { cwd: config.workspacePath })` is valid.

### C) Verified: JSONL event types match pi-agent-core ✅

```typescript
// node_modules/@mariozechner/pi-agent-core/dist/types.d.ts
{ type: "message_end"; message: AgentMessage; }
{ type: "tool_execution_start"; toolCallId: string; toolName: string; args: any; }
{ type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean; }
```

Task 8's `processJsonlLine()` handles exactly these three event shapes. Correct.

### D) Verified: `dependsOn` already in plan-parser.ts ✅

AC17 pre-existing claim confirmed — `parseDependsOn()` and `dependsOn` field exist with test coverage.

### E) Minor: Task 7 test has embedded plan fixture with "### Task 1: Set up types"

This is test fixture content (a fake plan inside `extractTaskSection`'s test), not a real duplicate task. Not confusing in context.

### F) Minor: Task 11 creates `createStore(cwd)` twice

Two separate `createStore(cwd)` calls — one for `readPlanFile`, one for `getLearnings`. Should be a single instance. Non-blocking, obvious cleanup.

---

## Previous round feedback status

All blocking items from rounds 1–4 are addressed in the current plan:

| Issue | Status |
|-------|--------|
| Round 1: task ordering, pi CLI flags, workspace path, SIGTERM→SIGKILL, jj guard, UPSTREAM pin | ✅ All fixed |
| Round 2: AC5 phase field, agent system prompt, thinking flag, resolveAgent robustness | ✅ All fixed |
| Round 3: AC16 satellite root, AC7 full diff, JSONL events, AC20 assistant errors, scout tools, prompt @file, merge semantics, dep validation, timeout race | ✅ All fixed |
| Round 4: YAML arrays, atomic status writes, isTestCommand gating, pi.exec cwd | ✅ All fixed |
| Round 5: AC5 interpretation confirmed | ✅ Fixed |

---

## Verdict: **pass**

The plan is ready for implementation. 15 well-structured tasks with complete test code, implementation code, file paths, and dependency annotations. All 21 ACs are covered. All prior review feedback has been incorporated. The two minor items (RunnerState.timedOut placement, double createStore) are non-blocking and will be caught by normal TDD flow.
