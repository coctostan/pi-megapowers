# Plan: Subagent Pipeline (#084) — v8

## Conventions
- Language: TypeScript
- Test runner: `bun test`
- Per-test command: `bun test tests/<file>.test.ts`
- Imports in TS files use `.js` extension

## AC → Task Mapping

| AC | Task(s) |
|---|---|
| 3 | 1 |
| 1 | 2 |
| 17 | 3, 4, 5, 6 |
| 18 | 7 |
| 2 | 8 |
| 13, 14, 15 | 9, 10 |
| 10, 11 | 11 |
| 12 | 12, 18 |
| 23, 24 | 13 |
| 19, 20, 21, 22 | 14, 15 |
| 4, 8, 16 | 16 |
| 5 | 17 |
| 6 | 18 |
| 7, 9 | 19 |
| 26 | 20, 22 |
| 27 | 21, 24 |
| 25 | 22, 29 |
| 28 | 23 |
| 29, 30 | 25, 29 |
| 31, 32, 33 | 26 |
| 34 | 30 |

---

### Task 1: Add `pi-subagents` dependency [no-test]
**Covers AC 3.**

**Justification:** package dependency + lockfile update only.

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

### Task 2: Create dispatcher contract types [no-test]
**Covers AC 1.**

**Justification:** interface/type scaffold only.

**Files:**
- Create: `extensions/megapowers/subagent/dispatcher.ts`

**Step 1 — Make the change**
Create:
```ts
export interface DispatchConfig {
  agent: string;
  task: string;
  cwd: string;
  systemPrompt?: string;
  model?: string;
  tools?: string[];
  thinking?: "none" | "low" | "medium" | "high";
  context?: string;
  timeoutMs?: number;
}

export interface DispatchResult {
  exitCode: number;
  messages: unknown[];
  filesChanged: string[];
  testsPassed: boolean | null;
  error?: string;
}

export interface Dispatcher {
  dispatch(config: DispatchConfig): Promise<DispatchResult>;
}
```

**Step 2 — Verify**
Run: `bunx tsc --noEmit`
Expected: no type errors.

---

### Task 3: Extract changed files from tool calls
**Covers AC 17.**

**Files:**
- Create: `extensions/megapowers/subagent/message-utils.ts`
- Test: `tests/message-utils-files.test.ts`

**Step 1 — Write the failing test**
Add test that asserts write/edit paths are deduped and ordered.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/message-utils-files.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/subagent/message-utils.js'`.

**Step 3 — Write minimal implementation**
Implement `extractFilesChanged(messages)` in `message-utils.ts`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/message-utils-files.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 4: Extract test pass/fail from bash tool calls [depends: 3]
**Covers AC 17.**

**Files:**
- Modify: `extensions/megapowers/subagent/message-utils.ts`
- Test: `tests/message-utils-tests-passed.test.ts`

**Step 1 — Write the failing test**
Add test cases:
- returns `true` for test command output with no failures
- returns `false` for failures
- returns `null` when no test command was run

**Step 2 — Run test, verify it fails**
Run: `bun test tests/message-utils-tests-passed.test.ts`
Expected: FAIL — `extractTestsPassed is not a function`.

**Step 3 — Write minimal implementation**
Implement `extractTestsPassed(messages)` with command pattern matching for `bun test`, `npm test`, `pnpm test`, `vitest`, `jest`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/message-utils-tests-passed.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 5: Extract final assistant output and ordered tool calls [depends: 3]
**Covers AC 17.**

**Files:**
- Modify: `extensions/megapowers/subagent/message-utils.ts`
- Test: `tests/message-utils-output-and-toolcalls.test.ts`

**Step 1 — Write the failing test**
Add tests that assert:
- `extractFinalOutput(messages)` concatenates assistant text blocks
- `extractToolCalls(messages)` returns ordered calls and pairs bash command with result output

**Step 2 — Run test, verify it fails**
Run: `bun test tests/message-utils-output-and-toolcalls.test.ts`
Expected: FAIL — missing exports for `extractFinalOutput` / `extractToolCalls`.

**Step 3 — Write minimal implementation**
Implement `extractFinalOutput` and `extractToolCalls` in `message-utils.ts`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/message-utils-output-and-toolcalls.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 6: Parse step result payload [depends: 3, 4, 5]
**Covers AC 17.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results-step.test.ts`

**Step 1 — Write the failing test**
Add test that asserts `parseStepResult(dispatchResult)` returns:
- `filesChanged`
- `testsPassed`
- `finalOutput`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results-step.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/subagent/pipeline-results.js'`.

**Step 3 — Write minimal implementation**
Implement `parseStepResult` by delegating to message utils.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results-step.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 7: Parse reviewer verdict and findings [depends: 6]
**Covers AC 18.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results-review.test.ts`

**Step 1 — Write the failing test**
Add tests:
- `Verdict: approve` → `{ verdict: 'approve' }`
- `Verdict: reject` with bullets → findings parsed

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results-review.test.ts`
Expected: FAIL — `parseReviewVerdict is not a function`.

**Step 3 — Write minimal implementation**
Implement `parseReviewVerdict(text)` using explicit verdict token + bullet parsing.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 8: Implement `PiSubagentsDispatcher` adapter [depends: 2]
**Covers AC 2.**

**Files:**
- Create: `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- Test: `tests/pi-subagents-dispatcher.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- `dispatch()` calls injected `runSync` once
- config maps to `RunSyncOptions`
- return maps to `DispatchResult`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement class `PiSubagentsDispatcher implements Dispatcher` with constructor-injected `runSync`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 9: TDD auditor file classification and config exclusion
**Covers AC 14, 15.**

**Files:**
- Create: `extensions/megapowers/subagent/tdd-auditor.ts`
- Test: `tests/tdd-auditor-classification.test.ts`

**Step 1 — Write the failing test**
Add tests for:
- test file patterns: `*.test.ts`, `*.spec.ts`, `tests/*.ts`
- config-only writes excluded (`package.json`, `tsconfig.json`, `.gitignore`)

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tdd-auditor-classification.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement path classification helpers and exclusion logic.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tdd-auditor-classification.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 10: TDD auditor ordering report [depends: 9]
**Covers AC 13.**

**Files:**
- Modify: `extensions/megapowers/subagent/tdd-auditor.ts`
- Test: `tests/tdd-auditor-ordering.test.ts`

**Step 1 — Write the failing test**
Add tests for report fields:
- `testWrittenFirst`
- `testRanBeforeProduction`
- `productionFilesBeforeTest`
- `testRunCount`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tdd-auditor-ordering.test.ts`
Expected: FAIL — assertion mismatch on report shape.

**Step 3 — Write minimal implementation**
Implement `auditTddCompliance(toolCalls)` returning exact report type.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tdd-auditor-ordering.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 11: Pipeline context base and step appends
**Covers AC 10, 11.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-context.ts`
- Test: `tests/pipeline-context-base.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- `buildInitialContext()` includes task, plan section, spec/diagnosis, learnings
- `appendStepOutput()` appends immutable step records

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context-base.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement `buildInitialContext` and `appendStepOutput`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context-base.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 12: Retry context accumulation and rendering [depends: 11]
**Covers AC 12.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-context.ts`
- Test: `tests/pipeline-context-retry.test.ts`

**Step 1 — Write the failing test**
Add explicit regression test:
- multiple `setRetryContext()` calls accumulate findings (do not replace)
- `renderContextPrompt()` includes latest retry reason + all findings

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context-retry.test.ts`
Expected: FAIL — previous finding missing in rendered prompt.

**Step 3 — Write minimal implementation**
Implement `setRetryContext` with append semantics and implement `renderContextPrompt`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context-retry.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 13: Pipeline JSONL logging
**Covers AC 23, 24.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-log.ts`
- Test: `tests/pipeline-log.test.ts`

**Step 1 — Write the failing test**
Add tests for `writeLogEntry` and `readPipelineLog` preserving order and optional `error`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-log.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement JSONL append/read helpers at `.megapowers/subagents/{pipelineId}/log.jsonl`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-log.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 14: Pipeline workspace lifecycle operations
**Covers AC 19, 20, 21, 22.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace-lifecycle.test.ts`

**Step 1 — Write the failing test**
Add tests asserting command sequences for:
- `createPipelineWorkspace`
- `squashPipelineWorkspace`
- `cleanupPipelineWorkspace`
with injected `execJJ`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace-lifecycle.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement lifecycle functions and `ExecJJ` injection.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace-lifecycle.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 15: Workspace diff helper [depends: 14]
**Covers AC 7 payload support.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace-diff.test.ts`

**Step 1 — Write the failing test**
Add test asserting `getWorkspaceDiff()` returns `{ summary, diff }` and empty fallback on command error.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace-diff.test.ts`
Expected: FAIL — `getWorkspaceDiff is not a function`.

**Step 3 — Write minimal implementation**
Implement `getWorkspaceDiff(cwd, execJJ)` using `jj diff --summary` and `jj diff`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace-diff.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 16: Pipeline runner happy path + reviewer TDD context [depends: 6, 7, 10, 11, 12, 13]
**Covers AC 4, 8, 16.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner-happy.test.ts`

**Step 1 — Write the failing test**
Add test that stubs dispatcher with successful implement/verifier/reviewer outputs and asserts:
- dispatch order is implement → verify → review
- final result is `completed`
- reviewer input context contains TDD report fields (`testWrittenFirst`, `testRunCount`)

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner-happy.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement initial `runPipeline` happy-path flow and inject TDD report before review dispatch.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner-happy.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 17: Pipeline runner verify-failure retry [depends: 16]
**Covers AC 5.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner-verify-retry.test.ts`

**Step 1 — Write the failing test**
Add test where cycle-1 verify fails and cycle-2 succeeds; assert second implement context includes prior verify output/retry reason.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner-verify-retry.test.ts`
Expected: FAIL — second implement dispatch context missing verify failure details.

**Step 3 — Write minimal implementation**
Add retry branch for verify-fail path using `setRetryContext` and rerun implement→verify.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner-verify-retry.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 18: Pipeline runner review-rejection retry [depends: 12, 16]
**Covers AC 6, 12.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner-review-retry.test.ts`

**Step 1 — Write the failing test**
Add test where reviewer rejects cycle-1 then approves cycle-2; assert cycle-2 implement context contains accumulated review findings.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner-review-retry.test.ts`
Expected: FAIL — findings from previous cycle not present in next implement context.

**Step 3 — Write minimal implementation**
Add review-reject retry branch and propagate accumulated findings into re-implement context.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner-review-retry.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 19: Pipeline timeout/budget paused result [depends: 13, 15, 16]
**Covers AC 7, 9.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner-paused.test.ts`

**Step 1 — Write the failing test**
Add tests:
- step timeout counts toward retry budget
- budget exhaustion returns `paused` with `logEntries`, `diff`, `errorSummary`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner-paused.test.ts`
Expected: FAIL — paused payload missing one of log/diff/errorSummary.

**Step 3 — Write minimal implementation**
Add timeout wrapper + budget loop + paused result assembly.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner-paused.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 20: Task dependency validator
**Covers AC 26.**

**Files:**
- Create: `extensions/megapowers/subagent/task-deps.ts`
- Test: `tests/task-deps.test.ts`

**Step 1 — Write the failing test**
Add tests for valid/no-deps, unmet deps, and missing task index.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/task-deps.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement `validateTaskDependencies(tasks, taskIndex, completedTasks)`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/task-deps.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 21: Pipeline metadata store for resume
**Covers AC 27 (resume persistence).**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-meta.ts`
- Test: `tests/pipeline-meta.test.ts`

**Step 1 — Write the failing test**
Add tests for write/read/clear metadata under `.megapowers/subagents`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-meta.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement `writePipelineMeta`, `readPipelineMeta`, `clearPipelineMeta`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-meta.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 22: Pipeline tool validation + dispatch bootstrap [depends: 19, 20, 21]
**Covers AC 25, 26.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool-validate.test.ts`

**Step 1 — Write the failing test**
Add tests asserting tool handler:
- rejects invalid task index
- rejects unmet task dependencies
- invokes runner for valid task

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool-validate.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement `handlePipelineTool` validation + runner invocation.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool-validate.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 23: Pipeline tool completed-flow side effects [depends: 14, 22]
**Covers AC 28.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool-completed.test.ts`

**Step 1 — Write the failing test**
Add test asserting completed result triggers:
- workspace squash
- metadata clear
- `megapowers_signal({ action: 'task_done' })`

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool-completed.test.ts`
Expected: FAIL — one or more side effects not called.

**Step 3 — Write minimal implementation**
Add completed-branch side effects in handler.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool-completed.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 24: Pipeline tool paused payload + resume [depends: 21, 22]
**Covers AC 27.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool-paused-resume.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- paused return includes `log`, `diff`, `errorSummary`
- metadata is persisted on pause
- `{ resume: true, guidance }` reuses existing workspace metadata

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool-paused-resume.test.ts`
Expected: FAIL — paused payload missing one required field.

**Step 3 — Write minimal implementation**
Implement paused branch + resume lookup and guidance pass-through.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool-paused-resume.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 25: One-shot subagent tool handler [depends: 8, 14, 6]
**Covers AC 29, 30.**

**Files:**
- Create: `extensions/megapowers/subagent/oneshot-tool.ts`
- Test: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- success path squashes workspace and returns result
- failure path cleans workspace and returns error

**Step 2 — Run test, verify it fails**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: FAIL — module not found.

**Step 3 — Write minimal implementation**
Implement `handleSubagentTool({ task, agent?, timeoutMs? })`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 26: Agent prompt definitions [no-test]
**Covers AC 31, 32, 33.**

**Justification:** prompt markdown artifacts.

**Files:**
- Create: `.pi/agents/implementer.md`
- Create: `.pi/agents/reviewer.md`
- Create: `.pi/agents/verifier.md`

**Step 1 — Make the change**
- `implementer.md`: explicit TDD loop + include `megapowers_signal` in `tools:` frontmatter for `tests_failed` signaling.
- `reviewer.md`: evaluate against AC + TDD report and output strict format:
  - `Verdict: approve|reject`
  - `Findings:` bullet list
- `verifier.md`: run tests and report pass/fail with key output.

**Step 2 — Verify**
Run: `bunx tsc --noEmit`
Expected: no type/import errors.

Run: `bun test tests/tools-wiring.test.ts`
Expected: agent names resolve without loader failures.

---

### Task 27: Satellite compatibility for `PI_SUBAGENT_DEPTH`
**Covers satellite compatibility requirement in scope.**

**Files:**
- Modify: `extensions/megapowers/satellite.ts`
- Test: `tests/satellite-root.test.ts`

**Step 1 — Write the failing test**
Add tests for:
- satellite detection with `PI_SUBAGENT_DEPTH`
- backwards compatibility with `PI_SUBAGENT=1`
- nested workspace project-root resolution

**Step 2 — Run test, verify it fails**
Run: `bun test tests/satellite-root.test.ts`
Expected: FAIL — detection only recognizes `PI_SUBAGENT=1`.

**Step 3 — Write minimal implementation**
Update environment checks and root-resolution logic.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/satellite-root.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 28: Commands filtering updates for new tools
**Covers command/tool exposure updates in scope.**

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/commands-filtering.test.ts`

**Step 1 — Write the failing test**
Add assertions for enabled/disabled megapowers states with `pipeline` and one-shot `subagent`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/commands-filtering.test.ts`
Expected: FAIL — filter list does not match new tool set.

**Step 3 — Write minimal implementation**
Update allow/deny tool lists for `/mega on` and `/mega off`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/commands-filtering.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 29: Register tools (`pipeline`, one-shot `subagent`) and remove legacy status tool [depends: 8, 22, 25]
**Covers AC 25, 29 integration path.**

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tools-wiring.test.ts`

**Step 1 — Write the failing test**
Add tests asserting:
- `pipeline` registered with `{ taskIndex, resume?, guidance? }`
- `subagent` points to one-shot handler
- legacy `subagent_status` not registered

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tools-wiring.test.ts`
Expected: FAIL — old registration still present.

**Step 3 — Write minimal implementation**
Wire `handlePipelineTool` and `handleSubagentTool`; remove legacy status registration.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tools-wiring.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

Run: `bunx tsc --noEmit`
Expected: no type errors

---

### Task 30: Clean-slate replacement of legacy subagent implementation [depends: 29]
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
Add `tests/clean-slate.test.ts` that:
1) asserts importing each deleted module throws module-not-found,
2) asserts `extensions/megapowers/subagent/` only contains new v1 files (whitelist assertion).

**Step 2 — Run test, verify it fails**
Run: `bun test tests/clean-slate.test.ts`
Expected: FAIL — at least one legacy module/file still exists.

**Step 3 — Write minimal implementation**
Delete all listed legacy files.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/clean-slate.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

## Completion checklist
- [ ] All AC 1–34 mapped to at least one task
- [ ] Task dependencies annotated and acyclic
- [ ] Retry accumulation test exists (Task 12)
- [ ] Reviewer context includes TDD report assertion (Task 16)
- [ ] Paused payload includes `log + diff + errorSummary` (Task 24)
- [ ] `implementer` agent includes `megapowers_signal` tool (Task 26)
- [ ] Reviewer agent name is exactly `reviewer` (Task 26)
- [ ] `bun test` and `bunx tsc --noEmit` pass at end
