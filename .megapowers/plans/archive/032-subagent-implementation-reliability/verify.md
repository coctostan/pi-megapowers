## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)
 543 pass
 0 fail
 972 expect() calls
Ran 543 tests across 30 files. [456.00ms]
```

All 543 tests pass across 30 test files, including the new subagent-specific test files: `subagent-runner.test.ts`, `subagent-validate.test.ts`, `subagent-status.test.ts`, `subagent-agents.test.ts`, `subagent-workspace.test.ts`, `subagent-async.test.ts`, `subagent-tools.test.ts`, `subagent-context.test.ts`, `subagent-errors.test.ts`, and `satellite-root.test.ts`.

---

## Per-Criterion Verification

### Criterion 1: `subagent` tool registered via `pi.registerTool()`, accepting task, optional agent name, optional task index
**Evidence:** `extensions/megapowers/index.ts` lines 367–381:
```ts
pi.registerTool({
  name: "subagent",
  label: "Subagent",
  description: "Delegate a task to a subagent running in an isolated jj workspace...",
  parameters: Type.Object({
    task: Type.String({ description: "Task description for the subagent" }),
    taskIndex: Type.Optional(Type.Number({ description: "Plan task index (validates dependencies)" })),
    agent: Type.Optional(Type.String({ description: "Agent name (default: worker)" })),
    timeoutMs: Type.Optional(Type.Number({ description: "Timeout in milliseconds (default: 600000)" })),
  }),
```
Test `satellite integration > index.ts registers subagent and subagent_status tools`: PASS
**Verdict:** pass

---

### Criterion 2: `subagent_status` tool registered via `pi.registerTool()`, accepting ID, returning state + results
**Evidence:** `extensions/megapowers/index.ts` lines 589–610:
```ts
pi.registerTool({
  name: "subagent_status",
  label: "Subagent Status",
  description: "Check the status of a running subagent. Returns JSON with state, files changed, test results, diff, and detected errors.",
  parameters: Type.Object({
    id: Type.String({ description: "Subagent ID returned from the subagent tool" }),
  }),
```
Test `handleSubagentStatus > returns status for running subagent`: PASS
**Verdict:** pass

---

### Criterion 3: jj workspace created via `jj workspace add` with name derived from subagent ID
**Evidence:** `extensions/megapowers/index.ts` line 421: `const wsName = buildWorkspaceName(id);`, line 424: `const wsResult = await pi.exec("jj", buildWorkspaceAddArgs(wsName, config.workspacePath));`

`subagent-workspace.ts`:
```ts
export function buildWorkspaceName(subagentId: string): string {
  return `mega-${subagentId}`;
}
export function buildWorkspaceAddArgs(workspaceName: string, targetPath: string): string[] {
  return ["workspace", "add", "--name", workspaceName, targetPath];
}
```
Test `buildWorkspaceAddArgs > returns jj workspace add args with name and target path`: PASS
**Verdict:** pass

---

### Criterion 4: Detached pi process spawned with `PI_SUBAGENT=1`, returns immediately with subagent ID
**Evidence:** `extensions/megapowers/index.ts` lines 435–447 (inside fire-and-forget `(async () => { ... })()`):
```ts
const child = spawn(args[0], args.slice(1), {
  cwd: config.workspacePath,
  env,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
```
Line 562: `child.unref();` — process is fully detached.
Line 581: return happens immediately with `Subagent dispatched: ${id}` before child completes.
`buildSpawnEnv` always sets `PI_SUBAGENT: "1"` (confirmed in `subagent-runner.ts`).
Test `buildSpawnEnv > sets PI_SUBAGENT=1`: PASS
**Verdict:** pass

---

### Criterion 5: Spawned subprocess writes `status.json` in `.megapowers/subagents/<id>/`
**Evidence:** `subagent-status.ts`:
```ts
export function subagentDir(cwd: string, id: string): string {
  return join(cwd, ".megapowers", "subagents", id);
}
export function writeSubagentStatus(cwd: string, id: string, status: SubagentStatus): void {
  const filePath = join(dir, "status.json");
  ...uses atomic temp-file-then-rename...
}
```
`updateSubagentStatus` is called on `data` events: `updateSubagentStatus(ctx.cwd, id, { turnsUsed: runnerState.turnsUsed })`.
Initial status with `state: "running"`, `phase`, `turnsUsed: 0` written before spawn.
Test `writeSubagentStatus / readSubagentStatus > writes and reads status.json`: PASS
**Verdict:** pass

---

### Criterion 6: `subagent_status` returns structured data: state, filesChanged, test results, turnsUsed, detectedErrors
**Evidence:** `SubagentStatus` interface in `subagent-status.ts`:
```ts
export interface SubagentStatus {
  id: string;
  state: SubagentState;  // "running" | "completed" | "failed" | "timed-out"
  turnsUsed: number;
  startedAt: number;
  completedAt?: number;
  phase?: string;
  filesChanged?: string[];  // from jj diff --summary
  diff?: string;
  diffPath?: string;
  testsPassed?: boolean;
  error?: string;
  detectedErrors?: string[];
}
```
Tests `subagent_status returns JSON > status result is structured data, not just human text`: PASS
Tests `handleSubagentStatus > returns status for running subagent`, `returns diff for completed subagent`, `returns error info for failed subagent`, `returns detected errors for stuck subagent`: all PASS
**Verdict:** pass

---

### Criterion 7: `subagent_status` includes `jj diff` output on successful completion
**Evidence:** `index.ts` lines 510–540 (in `close` handler when `code === 0`):
```ts
const summaryResult = await pi.exec("jj", buildDiffSummaryArgs(), { cwd: config.workspacePath });
const filesChanged = parseTaskDiffFiles(summaryResult.stdout);
const fullDiffResult = await pi.exec("jj", buildDiffFullArgs(), { cwd: config.workspacePath });
// diff written to status (or diffPath for large diffs)
writeSubagentStatus(ctx.cwd, id, {
  state: "completed", filesChanged, diff, diffPath, testsPassed, ...
});
```
`buildDiffFullArgs()` returns `["diff"]` — full patch output.
Test `handleSubagentStatus > returns diff for completed subagent`: PASS
**Verdict:** pass

---

### Criterion 8: No auto-squash — `subagent_status` returns diff without squashing
**Evidence:** `subagent_status` execute handler (lines 589–614) only calls `handleSubagentStatus` and returns JSON. No `jj squash` call in the status path.
`buildWorkspaceSquashArgs` exists in `subagent-workspace.ts` but is never called from `subagent_status`.
Test `no auto-squash > handleSubagentStatus returns diff without squashing`: PASS
**Verdict:** pass

---

### Criterion 9: Workspace cleaned up via `jj workspace forget` regardless of exit path
**Evidence:** `index.ts` — cleanup appears in three places:
1. `close` handler (success/fail/timeout) — lines 555–558: `await pi.exec("jj", buildWorkspaceForgetArgs(wsName));` in try/catch
2. Outer catch block (spawn failure) — lines 566–568: same call after writing `failed` status
`buildWorkspaceForgetArgs(wsName)` returns `["workspace", "forget", wsName]`.
Test `buildWorkspaceForgetArgs > returns jj workspace forget args` and `cleanup contract > buildWorkspaceForgetArgs produces valid cleanup command for any workspace name`: PASS
**Verdict:** pass

---

### Criterion 10: Non-zero exit → state "failed", workspace cleaned up, error included
**Evidence:** `index.ts` close handler:
```ts
if (code !== 0) {
  writeSubagentStatus(ctx.cwd, id, {
    state: "failed",
    error: `Process exited with code ${code}. ${stderr}`.trim(),
    ...
  });
}
// workspace forget called after, always
```
Test `handleSubagentDispatch > returns error when jj is not available`, `subagent-tools.test.ts` subprocess exit with non-zero code pattern verified in `handleSubagentStatus > returns error info for failed subagent`: PASS
**Verdict:** pass

---

### Criterion 11: Configurable timeout (default 10 min), kills process, cleanup, state "timed-out"
**Evidence:** `subagent-async.ts`:
```ts
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
```
`index.ts` lines 462–471:
```ts
const timer = setTimeout(() => {
  runnerState.isTerminal = true;
  runnerState.timedOut = true;
  try { child.kill("SIGTERM"); } catch {}
  setTimeout(() => {
    try { if (!child.killed) child.kill("SIGKILL"); } catch {}
  }, 5000);
}, config.timeoutMs);
```
Close handler checks `runnerState.timedOut` and writes `state: "timed-out"` with error message.
Tests `DEFAULT_TIMEOUT_MS > defaults to 10 minutes` and `buildDispatchConfig > uses custom timeout when provided`: PASS
**Verdict:** pass

---

### Criterion 12: Agent definitions loaded from markdown with YAML frontmatter, searched project → user → builtin
**Evidence:** `subagent-agents.ts` `resolveAgent` function:
```ts
const searchDirs = [
  join(cwd, ".megapowers", "agents"),
  join(homeDirectory ?? homedir(), ".megapowers", "agents"),
  BUILTIN_AGENTS_DIR,  // join(thisDir, "..", "..", "agents")
];
```
`parseAgentFrontmatter` parses `name`, `model`, `tools`, `thinking` from `---` delimited YAML frontmatter.
Tests `resolveAgent > finds agent in project .megapowers/agents/ directory`, `falls back to builtin agents when not found in project`, `searches user home directory between project and builtin`, `project agent takes priority over builtin`: all PASS
**Verdict:** pass

---

### Criterion 13: Three builtin agent files — `worker.md`, `scout.md`, `reviewer.md`
**Evidence:** `ls agents/` → `reviewer.md scout.md worker.md`
- `worker.md`: `name: worker`, `model: claude-sonnet-4-20250514`, `tools: [read, write, edit, bash]`, `thinking: full`
- `scout.md`: `name: scout`, read-only tools
- `reviewer.md`: `name: reviewer`, read-only tools

Tests `builtin agent files > worker.md exists and parses with correct name`, `scout.md exists and parses with correct name`, `reviewer.md exists and parses with correct name`: all PASS
**Verdict:** pass

---

### Criterion 14: Agent frontmatter schema compatible with pi-subagents: `name`, `model`, `tools`, `thinking`
**Evidence:** `parseAgentFrontmatter` in `subagent-agents.ts` explicitly handles all four fields, including three `tools` formats (inline array, comma-separated, multiline YAML dash-items).
Tests `parseAgentFrontmatter > parses all four frontmatter fields`, `parses tools as comma-separated string`, `parses tools as YAML array syntax`, `parses tools as multiline YAML dash-item array`: all PASS
**Verdict:** pass

---

### Criterion 15: `subagent` tool available in all workflow phases, not gated to implement only
**Evidence:** `handleSubagentDispatch` only checks `state.megaEnabled` and `state.activeIssue` — no phase check.
Tests `subagent available in all phases > handleSubagentDispatch works in brainstorm phase`, `spec phase`, `plan phase`, `review phase`, `implement phase`, `verify phase`, `code-review phase`, `reproduce phase`, `diagnose phase`: all 9 PASS
**Verdict:** pass

---

### Criterion 16: Child sessions run with satellite TDD enforcement via `PI_SUBAGENT=1`
**Evidence:** `subagent-runner.ts` `buildSpawnEnv`:
```ts
const env = { ...process.env, PI_SUBAGENT: "1" };
```
`satellite.ts` `isSatelliteMode()` checks `process.env.PI_SUBAGENT === "1"`.
`index.ts` line 43: `if (isSatelliteMode())` triggers satellite mode with TDD-only enforcement.
Tests `satellite TDD enforcement > sets PI_SUBAGENT=1 in spawn env for TDD enforcement` and `sets MEGA_PROJECT_ROOT so satellite can read state`: PASS
**Verdict:** pass

---

### Criterion 17: Plan parser supports `[depends: N, M]` annotation, extracts `depends` field on `PlanTask`
**Evidence:** `plan-parser.ts`:
```ts
function parseDependsOn(raw: string): number[] | null {
  const match = raw.match(/\[depends:\s*([\d,\s]+)\]/i);
  ...
}
const dependsOn = parseDependsOn(raw);
if (dependsOn) task.dependsOn = dependsOn;
```
Tests `extractPlanTasks > extracts [depends: N, M] from task headers`, `extracts [depends: N] from numbered list items`, `parses [depends: ...] case-insensitively`, `combines [no-test] and [depends: N] annotations`, `existing plans without [depends:] parse identically (backward compat)`: all PASS
**Verdict:** pass

---

### Criterion 18: `subagent` validates dependency tasks are completed before spawning
**Evidence:** `subagent-tools.ts`:
```ts
if (input.taskIndex !== undefined) {
  const tasks = deriveTasks(cwd, state.activeIssue);
  const result = validateTaskDependencies(input.taskIndex, tasks, state.completedTasks);
  if (!result.valid) return { error: reason };
}
```
`validateTaskDependencies` in `subagent-validate.ts` checks `task.dependsOn` against `completedTasks`.
Tests `validateTaskDependencies > blocks task when dependencies are not completed`, `blocks task when some dependencies are not completed`, `allows task when all dependencies are completed`: PASS
Test `handleSubagentDispatch > blocks dispatch when task dependencies are not met`: PASS
**Verdict:** pass

---

### Criterion 19: Task context (plan section, learnings) passed to subagents
**Evidence:** `subagent-tools.ts` uses `extractTaskSection(planContent, taskIndex)` to get plan section, `buildSubagentPrompt({ taskDescription, planSection, learnings })` to construct the prompt passed to the subagent.
`subagent-context.ts` `extractTaskSection` supports both `### Task N:` header and `N. item` numbered list formats.
Tests `extractTaskSection > extracts full section for task 1`, `buildSubagentPrompt > includes task description in prompt`, `includes plan section when provided`, `includes learnings when provided`: all PASS
**Verdict:** pass

---

### Criterion 20: Error detection via heuristics — same error 3+ times = stuck agent
**Evidence:** `subagent-errors.ts`:
```ts
export function detectRepeatedErrors(lines: MessageLine[], threshold: number = 3): string[] {
  // counts normalized error occurrences, returns those >= threshold
}
```
`subagent-runner.ts` `processJsonlLine` collects error lines from both `tool_execution_end` stderr results and assistant message text.
Tests `detectRepeatedErrors > detects same error appearing 3+ times`, `returns empty array when no repeated errors`, `detects multiple different repeated errors`, `uses configurable threshold`: all PASS
Test `processJsonlLine > collects error lines from assistant message text (AC20)`: PASS
**Verdict:** pass

---

### Criterion 21: `UPSTREAM.md` in extension directory with pinned commit reference
**Evidence:** `cat extensions/megapowers/UPSTREAM.md` confirms:
- File exists at `extensions/megapowers/UPSTREAM.md`
- Contains `## pi-subagents` section
- Pinned commit: `1281c04 (feat: background mode toggle and --bg slash command flag)`
- Documents patterns used and patterns not used

Tests `UPSTREAM.md > exists in extensions/megapowers/ directory` and `UPSTREAM.md > contains pinned commit reference`: PASS
**Verdict:** pass

---

## Overall Verdict

**pass**

All 21 acceptance criteria are verified with direct code evidence and passing tests. The implementation:

- Registers both `subagent` and `subagent_status` tools via `pi.registerTool()` (AC1, AC2)
- Creates isolated jj workspaces via `jj workspace add` with `mega-<id>` naming (AC3)
- Spawns detached pi processes with `PI_SUBAGENT=1`, returns immediately (AC4, AC16)
- Writes `status.json` to `.megapowers/subagents/<id>/` with progressive updates (AC5)
- Returns structured status including state, filesChanged, testsPassed, turnsUsed, detectedErrors (AC6)
- Includes full `jj diff` on completion without auto-squashing (AC7, AC8)
- Cleans up jj workspace via `jj workspace forget` in all exit paths (AC9)
- Handles non-zero exit → "failed" and timeout → "timed-out" with 10-min default (AC10, AC11)
- Loads agent definitions from project → user → builtin priority chain (AC12)
- Ships `worker.md`, `scout.md`, `reviewer.md` builtin agents with correct frontmatter (AC13, AC14)
- Available in all phases without gate restriction (AC15)
- Plan parser extracts `[depends: N, M]` into `dependsOn` field (AC17)
- Validates dependencies before spawning when taskIndex provided (AC18)
- Passes task section from `plan.md` and learnings to subagent prompt (AC19)
- Detects repeated errors (≥3 occurrences) as stuck-agent signal (AC20)
- `UPSTREAM.md` exists with pinned commit `1281c04` (AC21)

Test suite: **543 pass, 0 fail** across 30 files.
