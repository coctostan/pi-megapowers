# Plan: Subagent Pipeline (#084) — v7

## AC → Task Mapping

| AC | Task(s) |
|---|---|
| 3 | 1 |
| 1 | 2 |
| 17 | 3, 10 |
| 2 | 4 |
| 13–15 | 5 |
| 10–12 | 6 |
| 23–24 | 7 |
| 19–22 | 8, 9 |
| 18 | 10 |
| 4–9, 16 | 11 |
| 26 | 12 |
| 27 | 13, 14 |
| 25, 28 | 14, 19 |
| 29–30 | 15 |
| 31–33 | 16 |
| 34 | 20 |

> v7 revisions requested by review:
> 1) Task 6 now includes an explicit regression test proving `setRetryContext()` accumulates findings across multiple calls (AC12).
> 2) Task 11 now includes explicit tests for review-rejection retry flow (AC6) and verify-failure context propagation into next implement attempt (AC5).
> 3) Task 14 dependency annotation now includes `[depends: 7]`, and paused-output test assertions require `log + diff + errorSummary` (AC27).

---

## Conventions
- Language: TypeScript
- Test runner: `bun test`
- Per-file test: `bun test tests/<file>.test.ts`
- Production import style: `.js` extension in TS imports

---

## Task 1: Add `pi-subagents` dependency [no-test]

**Justification:** dependency/lockfile only.

**Covers AC 3.**

**Files:**
- Modify: `package.json`

**Step 1 — Make the change**
Add dependency:
```json
{
  "dependencies": {
    "pi-subagents": "^0.11.0"
  }
}
```

**Step 2 — Verify**
Run: `bun install`
Expected: install succeeds.

Run: `bunx tsc --noEmit`
Expected: no type errors.

---

## Task 2: Dispatcher contract (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test]

**Justification:** interface/type-only scaffolding.

**Covers AC 1.**

**Files:**
- Create: `extensions/megapowers/subagent/dispatcher.ts`

**Step 1 — Make the change**
Define:
- `DispatchConfig` with `agent`, `task`, `cwd`, optional prompt/model/tools/thinking/context/timeout.
- `DispatchResult` with `exitCode`, `messages`, `filesChanged`, `testsPassed`, optional `error`.
- `Dispatcher` interface with `dispatch(config): Promise<DispatchResult>`.

**Step 2 — Verify**
Run: `bunx tsc --noEmit`
Expected: no type errors.

---

## Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`)

**Covers AC 17.**

**Files:**
- Create: `extensions/megapowers/subagent/message-utils.ts`
- Test: `tests/message-utils.test.ts`

**Step 1 — Write the failing test**
In `tests/message-utils.test.ts`, add tests that assert:
- write/edit tool calls are deduped into changed files.
- bash test output parsing returns `true` for `0 fail`, `false` when failures exist, `null` when no test command.
- assistant text blocks are collapsed into final output text.
- ordered tool call records include paired bash output.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/message-utils.test.ts`
Expected: FAIL — missing `message-utils.js` exports.

**Step 3 — Write minimal implementation**
Implement utility functions in `message-utils.ts`:
- scan assistant `tool_use` blocks for `write/edit` paths
- detect test commands from bash input (`bun test`, `npm test`, `pnpm test`, `vitest`, `jest`)
- pair tool result output with prior `bash` tool_use id
- concatenate assistant text into final output

**Step 4 — Run test, verify it passes**
Run: `bun test tests/message-utils.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 4: `PiSubagentsDispatcher` adapter (`runSync` wrapper + config translation)

**Covers AC 2.**

**Files:**
- Create: `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- Test: `tests/pi-subagents-dispatcher.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- `dispatch()` calls `runSync` once with translated `RunSyncOptions`.
- timeout/model/system/tools/thinking/context map correctly.
- result is translated into `DispatchResult` shape.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement class `PiSubagentsDispatcher implements Dispatcher`:
- constructor injects `runSync` (default from `pi-subagents`)
- map config to `runSync` options
- map `SingleResult` back to `DispatchResult`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 5: TDD auditor (`auditTddCompliance`)

**Covers AC 13, 14, 15.**

**Files:**
- Create: `extensions/megapowers/subagent/tdd-auditor.ts`
- Test: `tests/tdd-auditor.test.ts`

**Step 1 — Write the failing test**
Add tests for:
- compliant sequence: test write -> test run -> prod write -> test run
- violation: production write before test file
- config-only writes excluded (`package.json`, `tsconfig.json`, `.gitignore`)
- test file detection patterns: `*.test.ts`, `*.spec.ts`, `tests/*.ts`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tdd-auditor.test.ts`
Expected: FAIL — missing module.

**Step 3 — Write minimal implementation**
Implement pure function returning:
- `testWrittenFirst`
- `testRanBeforeProduction`
- `productionFilesBeforeTest`
- `testRunCount`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tdd-auditor.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 6: Pipeline context builder (`buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`)

**Covers AC 10, 11, 12.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-context.ts`
- Test: `tests/pipeline-context.test.ts`

**Step 1 — Write the failing test**
Create tests that cover:
1. initial context includes task description, plan section, spec/diagnosis, learnings
2. appended step output is rendered in prompt (`filesChanged`, test output, review findings, tdd report)
3. **AC12 regression:** multiple `setRetryContext()` calls accumulate findings

Use explicit AC12 test:
```ts
it("accumulates review findings across multiple setRetryContext calls", () => {
  let ctx = buildInitialContext({ taskDescription: "T" });
  ctx = setRetryContext(ctx, "Verify failed", ["F1: add edge-case test"]);
  ctx = setRetryContext(ctx, "Review rejected", ["F2: rename symbol"]);

  const prompt = renderContextPrompt(ctx);
  expect(prompt).toContain("## Retry Reason");
  expect(prompt).toContain("Review rejected"); // latest reason
  expect(prompt).toContain("F1: add edge-case test");
  expect(prompt).toContain("F2: rename symbol");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context.test.ts`
Expected: FAIL — missing context builder exports.

**Step 3 — Write minimal implementation**
Implement:
- `buildInitialContext()` initializes empty steps + `accumulatedReviewFindings: string[]`
- `appendStepOutput()` appends immutable step records
- `setRetryContext()` stores latest retry reason and appends (not replaces) findings
- `renderContextPrompt()` prints base context + prior step summaries + retry sections

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 7: Pipeline JSONL log (`writeLogEntry`, `readPipelineLog`)

**Covers AC 23, 24.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-log.ts`
- Test: `tests/pipeline-log.test.ts`

**Step 1 — Write the failing test**
Assert:
- writes one JSONL line per step to `.megapowers/subagents/{pipelineId}/log.jsonl`
- read returns typed entries preserving order and `error`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-log.test.ts`
Expected: FAIL — module missing.

**Step 3 — Write minimal implementation**
Implement append/read helpers with mkdir safeguards and typed interface:
`{ step, status, durationMs, summary, error? }`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-log.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 8: jj workspace manager (`createPipelineWorkspace`, `squashPipelineWorkspace`, `cleanupPipelineWorkspace`)

**Covers AC 19, 20, 21, 22.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**
Add tests asserting command sequences:
- create: `jj workspace add ...`
- squash: `jj squash` then `jj workspace forget`
- cleanup: `jj workspace forget` + directory remove
- `execJJ` dependency is injectable and used

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — missing module.

**Step 3 — Write minimal implementation**
Implement exported functions and `ExecJJ` type. Default `execJJ` wraps runtime execution; tests inject fake.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 9: Workspace diff helpers (`getWorkspaceDiff`) [depends: 8]

**Covers AC 7 (paused diff payload support).**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-diff.test.ts`

**Step 1 — Write the failing test**
Test `getWorkspaceDiff(cwd, execJJ)` returns:
- `summary` from `jj diff --summary`
- full `diff` from `jj diff`
- fallback empty strings on non-zero/empty output

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-diff.test.ts`
Expected: FAIL — helper missing/export not found.

**Step 3 — Write minimal implementation**
Add `getWorkspaceDiff` to workspace module; call `execJJ` twice and normalize output.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-diff.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) [depends: 3]

**Covers AC 17, 18.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- `parseStepResult` extracts files changed, test pass/fail, final output
- `parseReviewVerdict` returns `{ verdict: approve|reject, findings[] }`
- bullet findings parsed from reviewer text

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — module missing.

**Step 3 — Write minimal implementation**
Implement parser using message-utils outputs and simple verdict/finding regex parsing.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 11: Pipeline runner (`runPipeline`) — retries/timeouts/pause/completed [depends: 3, 5, 6, 7, 9, 10]

**Covers AC 4, 5, 6, 7, 8, 9, 16.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**
Build a dispatcher stub and add these tests:
1. happy path: `implementer -> verifier -> reviewer` returns `completed`
2. retry budget exhaustion returns `paused` with `logEntries`, `diff`, `errorSummary`
3. timeout thrown by step counts toward retry budget
4. reviewer context includes TDD report (`testWrittenFirst`, etc.)
5. **AC5 test:** verify failure output passed to next implement call
   - cycle1 verifier returns `0 pass\n1 fail`
   - assert second implement `cfg.context` contains `0 pass\n1 fail` and/or `## Retry Reason`
6. **AC6 test:** review rejection triggers full retry sequence
   - cycle1 reviewer: `Verdict: reject` + finding
   - cycle2 reviewer: `Verdict: approve`
   - assert dispatch order exactly:
     `implementer, verifier, reviewer, implementer, verifier, reviewer`
   - assert cycle2 implement context contains prior review finding under accumulated findings section

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: FAIL — missing `pipeline-runner.js`.

**Step 3 — Write minimal implementation**
Implement orchestrator loop:
- default `maxCycles=3`, `stepTimeoutMs=10m`
- per cycle: implement -> verify -> review
- append step outputs into pipeline context
- run TDD audit after implement and include in reviewer context
- on verify fail: `setRetryContext` with verify output
- on review reject: `setRetryContext` with review findings
- on exhausted budget: return `paused` + log + diff + error summary
- on approve: return `completed` with files/test output/verdict

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 12: Task dependency validator (`validateTaskDependencies`) [depends: none]

**Covers AC 26.**

**Files:**
- Create: `extensions/megapowers/subagent/task-deps.ts`
- Test: `tests/task-deps.test.ts`

**Step 1 — Write the failing test**
Assert:
- valid when no dependencies
- invalid with unmet deps returns `unmetDependencies`
- missing task returns error string

**Step 2 — Run test, verify it fails**
Run: `bun test tests/task-deps.test.ts`
Expected: FAIL — module missing.

**Step 3 — Write minimal implementation**
Implement dependency checks over plan tasks + completed task indices.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/task-deps.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 13: Pipeline resume metadata store (`pipeline-meta`) [depends: none]

**Covers AC 27 resume support.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-meta.ts`
- Test: `tests/pipeline-meta.test.ts`

**Step 1 — Write the failing test**
Assert write/read/clear behavior per task index under `.megapowers/subagents`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-meta.test.ts`
Expected: FAIL — module missing.

**Step 3 — Write minimal implementation**
Implement simple JSON file helpers:
`writePipelineMeta`, `readPipelineMeta`, `clearPipelineMeta`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-meta.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 14: Pipeline tool handler (`pipeline`) — validate task/deps, resume, squash+task_done, paused payload [depends: 7, 8, 11, 12, 13]

**Covers AC 25, 26, 27, 28.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`

**Step 1 — Write the failing test**
Add tests for:
1. rejects when `taskIndex` is not current plan task
2. validates dependencies before dispatch
3. on completed pipeline: squashes workspace and marks task done
4. resume uses existing workspace metadata (does not create another workspace)
5. **AC27 paused payload assertion:**
   - force a paused pipeline result from runner
   - assert return shape includes:
     - `paused.errorSummary` (defined)
     - `paused.log` (array with at least one entry)
     - `paused.diff` (defined when mock diff returns content)

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: FAIL — missing module.

**Step 3 — Write minimal implementation**
Implement `handlePipelineTool`:
- validate phase/current task/dependencies
- create or reuse workspace via metadata
- load plan section + spec/diagnosis + learnings context
- call `runPipeline`
- on completed: squash + clear meta + `task_done`
- on paused: persist meta and return `{ paused: { log, diff, errorSummary } }`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 15: One-shot subagent tool (`subagent`) [depends: 8, 10]

**Covers AC 29, 30.**

**Files:**
- Create: `extensions/megapowers/subagent/oneshot-tool.ts`
- Test: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**
Add tests:
- success path squashes workspace
- dispatch result text/files is returned
- failure path cleans workspace and returns error

**Step 2 — Run test, verify it fails**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: FAIL — missing module.

**Step 3 — Write minimal implementation**
Implement handler taking `{ task, agent?, timeoutMs? }`, dispatching once, squashing on success and cleaning up on failure.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 16: Agent definitions (`implementer`, `pipeline-reviewer`, `verifier`) [no-test]

**Justification:** prompt markdown artifacts.

**Covers AC 31, 32, 33.**

**Files:**
- Create: `.pi/agents/implementer.md`
- Create: `.pi/agents/pipeline-reviewer.md`
- Create: `.pi/agents/verifier.md`

**Step 1 — Make the change**
Add agent prompts:
- implementer: explicit TDD loop (write test -> run fail -> implement -> run pass) and include `megapowers_signal` in tools list for `tests_failed`
- reviewer: evaluate against acceptance criteria + TDD report, output structured `Verdict: approve|reject` and findings bullets
- verifier: run tests and report pass/fail plus relevant output

**Step 2 — Verify**
Run: `bunx tsc --noEmit`
Expected: no type errors (no broken imports from agent loader paths).

---

## Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution

**Covers satellite compatibility requirement included in plan scope.**

**Files:**
- Modify: `extensions/megapowers/satellite.ts`
- Test: `tests/satellite-root.test.ts`

**Step 1 — Write the failing test**
Add tests asserting satellite mode is detected when `PI_SUBAGENT_DEPTH` is set and project root resolves correctly for nested workspace execution.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/satellite-root.test.ts`
Expected: FAIL — old detection only checks `PI_SUBAGENT=1`.

**Step 3 — Write minimal implementation**
Update environment checks to accept `PI_SUBAGENT_DEPTH` and keep backwards compatibility for existing flag.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/satellite-root.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 18: Commands filtering updates (`/mega off`, `/mega on`)

**Covers command/tool exposure updates required by new tools.**

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/commands-filtering.test.ts`

**Step 1 — Write the failing test**
Assert command filtering keeps/removes tools correctly with new pipeline tooling rules.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/commands-filtering.test.ts`
Expected: FAIL — filtering list outdated.

**Step 3 — Write minimal implementation**
Adjust allowed/disallowed tool lists for enabled/disabled megapowers states.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/commands-filtering.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Task 19: Tool registration wiring (`pipeline`, rewritten `subagent`, remove old `subagent_status`) [depends: 4, 14, 15]

**Covers AC 25 and 28 integration path.**

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tools-wiring.test.ts`

**Step 1 — Write the failing test**
Assert:
- `pipeline` tool is registered with expected params `{ taskIndex, resume?, guidance? }`
- `subagent` tool points to one-shot handler
- legacy `subagent_status` is not registered

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tools-wiring.test.ts`
Expected: FAIL — old registrations still present.

**Step 3 — Write minimal implementation**
Wire handlers in `register-tools.ts`:
- add `pipeline`
- replace old async status subagent registration with one-shot path
- remove obsolete registration block

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tools-wiring.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Run: `bunx tsc --noEmit`
Expected: no type errors.

---

## Task 20: Clean-slate replacement of old subagent implementation [depends: 19]

**Covers AC 34.**

**Files:**
- Delete: `extensions/megapowers/subagent/subagent-agents.ts`
- Delete: `extensions/megapowers/subagent/subagent-async.ts`
- Delete: `extensions/megapowers/subagent/subagent-context.ts`
- Delete: `extensions/megapowers/subagent/subagent-errors.ts`
- Delete: `extensions/megapowers/subagent/subagent-runner.ts`
- Delete: `extensions/megapowers/subagent/subagent-status.ts`
- Delete: `extensions/megapowers/subagent/subagent-tools.ts`
- Delete: `extensions/megapowers/subagent/subagent-validate.ts`
- Delete: `extensions/megapowers/subagent/subagent-workspace.ts`
- Delete: `tests/subagent-agents.test.ts`
- Delete: `tests/subagent-async.test.ts`
- Delete: `tests/subagent-context.test.ts`
- Delete: `tests/subagent-errors.test.ts`
- Delete: `tests/subagent-runner.test.ts`
- Delete: `tests/subagent-status.test.ts`
- Delete: `tests/subagent-tools.test.ts`
- Delete: `tests/subagent-validate.test.ts`
- Delete: `tests/subagent-workspace.test.ts`
- Test: `tests/clean-slate.test.ts`

**Step 1 — Write the failing test**
Add `tests/clean-slate.test.ts` that attempts to import each deleted module and asserts import throws.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/clean-slate.test.ts`
Expected: FAIL — at least one legacy module still imports successfully.

**Step 3 — Write minimal implementation**
Delete all listed legacy modules and old tests.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/clean-slate.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Completion checklist
- [ ] All AC 1–34 have test-backed coverage or justified `[no-test]` tasks
- [ ] Task 6 regression test proves multi-call accumulation for retry findings
- [ ] Task 11 covers AC5 + AC6 retry behavior explicitly
- [ ] Task 14 includes `[depends: 7]` and paused payload assertion (`log + diff + errorSummary`)
- [ ] `bun test` and `bunx tsc --noEmit` both pass at end