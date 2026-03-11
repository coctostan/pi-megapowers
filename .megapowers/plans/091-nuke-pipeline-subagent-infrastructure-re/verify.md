# Verification Report — Issue 091
**Nuke Pipeline/Subagent Infrastructure**

Date: 2026-03-10

---

## Test Suite Results

```
bun test — 796 pass, 0 fail (76 files, 925ms)
```

Fresh run output (tail):
```
 796 pass
 0 fail
 1850 expect() calls
Ran 796 tests across 76 files. [925.00ms]
```

---

## Per-Criterion Verification

### Criterion 1: The megapowers extension no longer registers or exposes a `pipeline` tool in its tool surface.

**Evidence:**
- Command: `grep -n '"pipeline"' extensions/megapowers/register-tools.ts` → no matches (exit 1)
- `tests/register-tools.test.ts` confirms: `expect(Object.keys(tools)).not.toContain("pipeline")` — **PASS** (test passes)
- `tests/commands-tools-filter.test.ts` confirms: `expect(src).not.toContain('"pipeline"')` — **PASS** (test passes)
- `tests/mp-on-off.test.ts` confirms: `expect(pi.getActiveTools()).not.toContain("pipeline")` both on/off — **PASS**
- Direct inspection of `extensions/megapowers/register-tools.ts`: registers only `megapowers_signal`, `megapowers_plan_task`, `megapowers_plan_review`, `create_issue`, `create_batch` — no `pipeline` tool.

**Verdict:** **PASS**

---

### Criterion 2: The megapowers extension no longer registers or exposes the legacy one-shot `subagent` tool in its tool surface.

**Evidence:**
- Command: `grep -n '"subagent"' extensions/megapowers/register-tools.ts` → no matches (exit 1)
- `tests/register-tools.test.ts`: `expect(Object.keys(tools)).not.toContain("subagent")` — **PASS**
- `tests/commands-tools-filter.test.ts`: `expect(src).not.toContain('"subagent"')` — **PASS**
- `tests/mp-on-off.test.ts`: `expect(pi.getActiveTools()).not.toContain("subagent")` both on/off — **PASS**
- Direct inspection of `extensions/megapowers/register-tools.ts`: no `subagent` tool registration.

**Verdict:** **PASS**

---

### Criterion 3: Code that orchestrates implement → verify → review work in isolated workspaces/worktrees for the legacy implement-phase pipeline path is deleted and no longer reachable.

**Evidence:**
- `tests/legacy-subagent-stack-removed.test.ts` verifies the following files do NOT exist:
  - `extensions/megapowers/subagent/pipeline-tool.ts`
  - `extensions/megapowers/subagent/pipeline-runner.ts`
  - `extensions/megapowers/subagent/pipeline-workspace.ts`
  - `extensions/megapowers/subagent/pipeline-results.ts`
  - `extensions/megapowers/subagent/pipeline-context.ts`
  - `extensions/megapowers/subagent/pipeline-context-bounded.ts`
  - `extensions/megapowers/subagent/pipeline-log.ts`
  - `extensions/megapowers/subagent/pipeline-meta.ts`
  - `extensions/megapowers/subagent/pipeline-renderer.ts`
  - `extensions/megapowers/subagent/pipeline-steps.ts`
  - `extensions/megapowers/subagent/pipeline-schemas.ts`
  - (and related: `oneshot-tool.ts`, `task-deps.ts`, `message-utils.ts`, `tdd-auditor.ts`, `dispatcher.ts`, `pi-subagents-dispatcher.ts`)
- Test `deletes the legacy runtime modules` — **PASS** (796/0)
- `find . -name "*pipeline*" ... | grep -v node_modules/.d.ts` — only returns `.megapowers/plans` archive dirs (not runtime source files)
- `grep -rn "pipeline" extensions/ --include="*.ts"` → zero matches (exit 1)

**Verdict:** **PASS**

---

### Criterion 4: Workspace/worktree helper code that exists specifically to create, squash, or clean up legacy pipeline or legacy one-shot subagent workspaces is deleted and no longer referenced by runtime code.

**Evidence:**
- `tests/legacy-subagent-stack-removed.test.ts`: `extensions/megapowers/subagent/pipeline-workspace.ts` confirmed absent — **PASS**
- `tests/clean-slate.test.ts` verifies old subagent modules (`subagent-async.js`, `subagent-runner.js`, `subagent-status.js`, `subagent-tools.js`, `subagent-validate.js`) are not importable — **PASS**
- `grep -rn "pipeline\|subagent" extensions/ --include="*.ts" | grep -v "pi-subagents"` → only match is `MpTier` type in `mp-handlers.ts` line 4 (generic command-dispatch tier enum, not pipeline infrastructure). No workspace/worktree management code found.
- No `squashPipelineWorkspace` or `cleanupPipelineWorkspace` references in runtime code.

**Verdict:** **PASS**

---

### Criterion 5: Legacy pipeline-only result handling, context accumulation, auditing, dispatch, and related support code is deleted when it exists only for the removed implement-phase pipeline or legacy one-shot subagent path.

**Evidence:**
- `tests/legacy-subagent-stack-removed.test.ts`: verifies absence of:
  - `pipeline-results.ts` (result handling)
  - `pipeline-context.ts`, `pipeline-context-bounded.ts` (context accumulation)
  - `tdd-auditor.ts` (auditing)
  - `dispatcher.ts`, `pi-subagents-dispatcher.ts` (dispatch)
- All tests **PASS** (796/0)
- `tests/register-tools.test.ts` confirms: `expect(source).not.toContain("handleOneshotTool")`, `not.toContain("handlePipelineTool")`, `not.toContain("PiSubagentsDispatcher")`, `not.toContain("renderPipelineCall")`, `not.toContain("renderPipelineResult")` — **PASS**

**Verdict:** **PASS**

---

### Criterion 6: State-machine logic, state-shape fields, and transition handling that exist only for the removed legacy pipeline/subagent path are deleted or updated so no runtime state depends on that path.

**Evidence:**
- `tests/legacy-subagent-stack-removed.test.ts`: `"has no legacy-only state fields in retained state/runtime files"`:
  - Files checked: `state/state-io.ts`, `state/state-machine.ts`, `tools/tool-signal.ts`
  - `expect(source).not.toMatch(/pipeline(Id|Workspace)|subagentId/)` — **PASS**
- Direct inspection: `grep -rn "pipelineId\|pipelineWorkspace\|subagentId" extensions/megapowers/state/` → zero matches
- `grep -rn "pipeline\|subagent" extensions/megapowers/state/state-machine.ts` → zero matches
- `grep -rn "pipeline\|subagent" extensions/megapowers/tools/tool-signal.ts` → zero matches
- `grep -rn "pipeline\|subagent" extensions/megapowers/state/state-io.ts` → zero matches

**Verdict:** **PASS**

---

### Criterion 7: Legacy "satellite mode" behavior, guards, and user-facing messaging that exist only to support the removed legacy subagent implementation path are deleted.

**Evidence:**
- `tests/index-integration.test.ts`: `"index.ts does not import or branch on satellite mode"`:
  - `expect(source).not.toContain("isSatelliteMode")` — **PASS**
  - `expect(source).not.toContain("setupSatellite")` — **PASS**
  - `expect(source).not.toContain("if (satellite)")` — **PASS**
- `grep -rn "satellite" extensions/ --include="*.ts"` → only one match: a comment in `write-policy.ts` line 4: `// Used by tool-overrides.ts (disk-based) and satellite mode (in-memory).` — this is a stale comment, not runtime code/logic. No guard logic, branching, or user-facing messaging found.
- `grep -rn "PI_SUBAGENT\|satelliteMode\|satellite_mode" extensions/ --include="*.ts"` → zero matches

**Verdict:** **PASS** (stale comment in write-policy.ts does not constitute runtime satellite mode behavior/guards/messaging)

---

### Criterion 8: Prompt templates and other LLM-facing instruction files no longer describe or direct the model to use the removed legacy `pipeline` or legacy one-shot `subagent` implementation path.

**Evidence:**
- `grep -n "pipeline\|subagent" prompts/megapowers-protocol.md` → zero matches (exit 1)
- `grep -n "pipeline\|subagent" prompts/implement-task.md`:
  - Line 26: `**Do NOT use `pipeline` or `subagent` tools for implementation work in this session.** Do all implementation work inline here.`
  - This is a prohibition/warning against using those tools, NOT an advertisement or direction to use them.
- `tests/prompts.test.ts`: `"implement-task template explicitly prohibits legacy pipeline/subagent tools"`:
  - `expect(template).toMatch(/do not use.*pipeline|do not use.*subagent/i)` — **PASS**
- All other prompt files (`verify.md`, `code-review.md`, `write-plan.md`, `brainstorm.md`, etc.) — no `pipeline`/`subagent` references directing model to use the deleted path.
- `tests/tool-signal.test.ts` line 706: `"megapowers-protocol.md no longer advertises legacy pipeline/subagent worktrees"`:
  - `expect(source).not.toContain("Pipeline/subagent worktrees are also managed automatically.")` — **PASS**

**Verdict:** **PASS**

---

### Criterion 9: User-facing documentation no longer advertises the removed legacy implement-phase pipeline/subagent workflow, and any retained mentions clearly distinguish preserved `pi-subagents` functionality from the deleted legacy path.

**Evidence:**
- `grep -n "pipeline\|subagent" README.md | grep -v "pi-subagents"` → zero matches
- `grep -n "pipeline\|subagent" AGENTS.md | grep -v "pi-subagents"` → zero matches (exit 1)
- AGENTS.md only mention: line 54 `"Focused review fan-out: plan review may use preserved pi-subagents fan-out for advisory reviewers"` — clearly identifies this as `pi-subagents` (preserved), not the deleted legacy path.
- AGENTS.md custom tools section no longer lists `pipeline` or `subagent` tools.
- Note: `docs/plans/*.md` are historical design documents (dated Feb 2026); they are not user-facing documentation — they are archived design artifacts.

**Verdict:** **PASS**

---

### Criterion 10: Tests that exist only for the deleted legacy pipeline/subagent infrastructure are removed, and any remaining tests that referenced that infrastructure are updated to reflect the direct primary-session implementation model.

**Evidence:**
- `tests/legacy-subagent-stack-removed.test.ts`: new test verifying legacy files are absent — exists and **PASS**
- `tests/register-tools.test.ts`: updated to assert pipeline/subagent NOT registered — **PASS**
- `tests/clean-slate.test.ts`: updated to assert old subagent modules non-importable — **PASS**
- `tests/mp-on-off.test.ts`: updated to assert pipeline/subagent not in active tools — **PASS**
- `tests/commands-tools-filter.test.ts`: updated to check commands.ts doesn't reference legacy tools — **PASS**
- `tests/prompts.test.ts`: new tests confirm implement-task template prohibits pipeline/subagent and `buildImplementTaskVars` doesn't advertise delegation — **PASS**
- `tests/tool-signal.test.ts` line 706: new test confirms megapowers-protocol.md doesn't advertise legacy worktrees — **PASS**
- 796 tests pass, 0 fail — no test regressions from removal.

**Verdict:** **PASS**

---

### Criterion 11: The primary-session implementation flow continues to use sequential task execution in the main session with explicit TDD signaling, human oversight, and existing task progression state; specifically, `task_done`, `currentTaskIndex`, and `completedTasks` remain the mechanism for sequential implementation progress.

**Evidence:**
- `extensions/megapowers/state/state-machine.ts`:
  - Line 51: `currentTaskIndex: number;`
  - Line 52: `completedTasks: number[];`
  - Lines 85-86: initialized to `0` and `[]` in `createInitialState()`
- `extensions/megapowers/tools/tool-signal.ts`:
  - Line 21: `"task_done"` action present in signal type
  - Lines 39, 61-160: `task_done` handler reads `currentTaskIndex`, updates `completedTasks`, advances `currentTaskIndex` to next incomplete task
- `extensions/megapowers/register-tools.ts`: `megapowers_signal` registers `task_done` as a literal action type
- `prompts/implement-task.md`: directs model to work directly in session with TDD signaling
- `tests/prompts.test.ts`: `"buildImplementTaskVars does not advertise delegation to subagents"` — **PASS**
- `tests/tool-signal.test.ts`: extensive `task_done` handling tests — all **PASS**

**Verdict:** **PASS**

---

### Criterion 12: Newer `pi-subagents`-based functionality that is not part of the deleted legacy implement-phase pipeline/subagent infrastructure remains present, wired, and usable, and `pi-subagents` is not removed solely as part of this cleanup.

**Evidence:**
- `extensions/megapowers/plan-review/focused-review-runner.ts` imports:
  - `from "pi-subagents/agents.js"` (line 3)
  - `from "pi-subagents/execution.js"` (line 4)
- `tests/legacy-subagent-stack-removed.test.ts`: `"keeps focused review wired to pi-subagents"`:
  - `expect(runner).toContain('from "pi-subagents/agents.js"')` — **PASS**
  - `expect(runner).toContain('from "pi-subagents/execution.js"')` — **PASS**
  - `expect(runner).not.toContain("pi-subagents-dispatcher")` — **PASS**
- `tests/focused-review.test.ts`: verifies `runtime` is `"pi-subagents"` — **PASS**
- `tests/focused-review-runner.test.ts`: verifies three focused reviewers run in parallel through pi-subagents — **PASS**
- `tests/hooks-focused-review.test.ts`: verifies plan review triggers pi-subagents fan-out for ≥5 tasks — **PASS**
- `extensions/megapowers/pi-subagents.d.ts` remains present (ambient module declarations)

**Verdict:** **PASS**

---

## Overall Verdict

**PASS**

All 12 acceptance criteria are satisfied. The 796-test suite passes with 0 failures. Evidence summary:

- **AC1 & AC2**: `register-tools.ts` only registers 5 tools (`megapowers_signal`, `megapowers_plan_task`, `megapowers_plan_review`, `create_issue`, `create_batch`) — no `pipeline` or `subagent` tool.
- **AC3 & AC4 & AC5**: All legacy pipeline/subagent source modules (17 files listed in `legacy-subagent-stack-removed.test.ts`) are confirmed absent from the filesystem. No workspace/worktree management, result handling, context accumulation, auditing, or dispatch code remains in `extensions/`.
- **AC6**: State machine files have zero references to `pipelineId`, `pipelineWorkspace`, or `subagentId`. `task_done`/`currentTaskIndex`/`completedTasks` remain the progression mechanism.
- **AC7**: `index.ts` has no `isSatelliteMode`, `setupSatellite`, or `if (satellite)` branching. One stale comment remains in `write-policy.ts` but no runtime guard logic.
- **AC8**: Prompt templates prohibit (not advertise) legacy tools. `megapowers-protocol.md` has zero pipeline/subagent references.
- **AC9**: `README.md` and `AGENTS.md` have zero legacy pipeline/subagent mentions. `pi-subagents` mentions in AGENTS.md clearly identify preserved functionality.
- **AC10**: Dedicated removal tests added; existing tests updated; 796/0 pass/fail.
- **AC11**: `task_done` signal + `currentTaskIndex` + `completedTasks` fully wired and tested.
- **AC12**: `focused-review-runner.ts` imports `pi-subagents` directly; fan-out tests pass.
