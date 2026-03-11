# Verification Report — 091-nuke-pipeline-subagent-infrastructure-re

## Test Suite Results

```
bun test
795 pass
0 fail
1849 expect() calls
Ran 795 tests across 76 files. [973ms]
```

All tests pass fresh.

---

## Per-Criterion Verification

### Criterion 1: pipeline tool no longer registered or exposed
**Evidence:**
- `extensions/megapowers/register-tools.ts` inspected: no `name: "pipeline"` registration anywhere in the file.
- Test `tests/register-tools.test.ts` line 21: `expect(Object.keys(tools)).not.toContain("pipeline")` — passes.
- Test `tests/mp-on-off.test.ts` lines 45, 65: `expect(pi.getActiveTools()).not.toContain("pipeline")` — passes.
- Test `tests/commands-tools-filter.test.ts` line 10: `expect(src).not.toContain('"pipeline"')` — passes.

**Verdict:** pass

---

### Criterion 2: subagent tool no longer registered or exposed
**Evidence:**
- `extensions/megapowers/register-tools.ts` inspected: no `name: "subagent"` registration anywhere in the file.
- Test `tests/register-tools.test.ts` line 22: `expect(Object.keys(tools)).not.toContain("subagent")` — passes.
- Test `tests/mp-on-off.test.ts` lines 45–46, 65–66: `expect(pi.getActiveTools()).not.toContain("subagent")` — passes.
- Test `tests/commands-tools-filter.test.ts` line 11: `expect(src).not.toContain('"subagent"')` — passes.
- Test `tests/register-tools.test.ts` lines 44–47: verifies source contains none of `handleOneshotTool`, `handlePipelineTool`, `PiSubagentsDispatcher`, `name: "pipeline"`, `name: "subagent"`.

**Verdict:** pass

---

### Criterion 3: Orchestration code for legacy pipeline deleted
**Evidence:**
- `extensions/megapowers/subagent/` directory is empty (confirmed via `ls -la`).
- `tests/legacy-subagent-stack-removed.test.ts` checks 17 specific files are absent:
  `oneshot-tool.ts`, `pipeline-tool.ts`, `pipeline-runner.ts`, `pipeline-workspace.ts`, `pipeline-results.ts`, `pipeline-context.ts`, `pipeline-context-bounded.ts`, `pipeline-log.ts`, `pipeline-meta.ts`, `pipeline-renderer.ts`, `pipeline-steps.ts`, `task-deps.ts`, `message-utils.ts`, `tdd-auditor.ts`, `dispatcher.ts`, `pi-subagents-dispatcher.ts`, `pipeline-schemas.ts` — all `existsSync()` return false. Test passes.
- `grep -rn "pipeline" extensions/ --include="*.ts"` returns no hits outside `.d.ts`.

**Verdict:** pass

---

### Criterion 4: Workspace/worktree helper code for legacy pipeline deleted
**Evidence:**
- `extensions/megapowers/subagent/pipeline-workspace.ts` does not exist (covered by AC3 test).
- The remaining `squash*` functions in `extensions/megapowers/vcs/branch-manager.ts` are `squashBranchToSingleCommit` and `squashAndPush` — these serve the done-phase `push-and-pr` shipping path (VCS lifecycle), not pipeline workspaces.
- `tests/legacy-subagent-stack-removed.test.ts`: all pipeline workspace files absent — passes.
- `grep -rn "squashPipeline\|cleanupPipeline\|pipelineWorkspace" extensions/` — no matches.

**Verdict:** pass

---

### Criterion 5: Legacy pipeline-only support code deleted
**Evidence:**
- `extensions/megapowers/subagent/` is empty; all `pipeline-results.ts`, `tdd-auditor.ts`, `dispatcher.ts`, `pipeline-context*.ts`, `pipeline-log.ts` are gone.
- `tests/legacy-subagent-stack-removed.test.ts` line 52: `expect(source).not.toMatch(/pipeline(Id|Workspace)|subagentId/)` — verifies no legacy state fields in retained runtime files. Passes.
- `grep -rn "handleOneshotTool|handlePipelineTool|renderPipelineCall|renderPipelineResult|PiSubagentsDispatcher" extensions/` — no matches.

**Verdict:** pass

---

### Criterion 6: State-machine logic for pipeline/subagent path deleted
**Evidence:**
- `extensions/megapowers/state/state-machine.ts` `MegapowersState` interface inspected: fields are `version`, `activeIssue`, `workflow`, `phase`, `phaseHistory`, `reviewApproved`, `planMode`, `planIteration`, `currentTaskIndex`, `completedTasks`, `tddTaskState`, `doneActions`, `doneChecklistShown`, `megaEnabled`, `branchName`, `baseBranch`. No `pipelineId`, `subagentId`, `pipelineWorkspace`, or any pipeline-specific field.
- `tests/legacy-subagent-stack-removed.test.ts` line 52 verifies absence of `pipelineId`, `pipelineWorkspace`, `subagentId` in `state-io.ts`, `state-machine.ts`, `tool-signal.ts`. Passes.

**Verdict:** pass

---

### Criterion 7: Legacy "satellite mode" behavior deleted
**Evidence:**
- `grep -rn "satellite|PI_SUBAGENT|isSatellite|setupSatellite" extensions/ --include="*.ts"` returns only one non-test hit: a comment in `write-policy.ts` line 4 (`// Used by tool-overrides.ts (disk-based) and satellite mode (in-memory).`). The code itself has no satellite-mode branches.
- `extensions/megapowers/index.ts`: `grep` for `isSatelliteMode`, `setupSatellite`, `if (satellite)` returns no matches.
- `tests/index-integration.test.ts` lines 49–53: verifies `index.ts` does not contain `isSatelliteMode`, `setupSatellite`, or `if (satellite)`. Passes.

**Verdict:** pass

---

### Criterion 8: Prompt templates no longer describe/direct the model to use legacy pipeline/subagent
**Evidence:**
- `prompts/implement-task.md` line 26: `**Do NOT use \`pipeline\` or \`subagent\` tools for implementation work in this session.**` — explicitly prohibits.
- `tests/prompts.test.ts` line 308–310: verifies `implement-task.md` matches `/do not use.*pipeline|do not use.*subagent/i`. Passes.
- **STALE REFERENCE FOUND:** `prompts/megapowers-protocol.md` line 33 ends with the sentence:
  > "Pipeline/subagent worktrees are also managed automatically."
  
  This sentence describes the legacy pipeline/subagent worktree infrastructure as though it is currently operational. This contradicts AC8: the file still describes the removed legacy path. No test currently catches this stale reference.

**Verdict:** fail — `prompts/megapowers-protocol.md` line 33 contains "Pipeline/subagent worktrees are also managed automatically." which describes the deleted legacy infrastructure as though it still exists.

---

### Criterion 9: User-facing documentation no longer advertises legacy pipeline/subagent workflow
**Evidence:**
- `AGENTS.md`: `grep -n "pipeline|subagent|satellite"` returns only line 54: "Focused review fan-out: plan review may use preserved `pi-subagents` fan-out for advisory reviewers" — correctly identifies `pi-subagents` as a preserved, distinct feature. No legacy pipeline/subagent workflow advertised.
- `README.md`: only references `pi-subagents` in the context of "Focused review fan-out" with advisory reviewers — correctly distinguished.
- `docs/plans/` contains archived historical implementation plans — not user-facing runtime documentation.

**Verdict:** pass

---

### Criterion 10: Tests for deleted infrastructure removed; remaining tests updated
**Evidence:**
- `tests/clean-slate.test.ts`: verifies old subagent module paths cannot be imported — passes.
- `tests/legacy-subagent-stack-removed.test.ts`: verifies 17 legacy file paths are absent and no legacy state fields remain — passes.
- `tests/register-tools.test.ts`, `tests/mp-on-off.test.ts`, `tests/commands-tools-filter.test.ts`, `tests/index-integration.test.ts`, `tests/prompts.test.ts`: all updated to assert the absence of legacy tools.
- Full suite: 795 pass, 0 fail.

**Verdict:** pass

---

### Criterion 11: Primary-session implementation flow preserved
**Evidence:**
- `extensions/megapowers/state/state-machine.ts`: `MegapowersState` contains `currentTaskIndex: number` and `completedTasks: number[]`; `createInitialState()` initializes both; `transition()` uses `completedTasks` and `currentTaskIndex` when entering `implement`.
- `extensions/megapowers/tools/tool-signal.ts`: `task_done` case is present (line 21, 39, 61–154); advances `currentTaskIndex` and appends to `completedTasks`.
- `prompts/implement-task.md`: directs inline execution — "Work directly in this session. TDD is enforced via tdd-guard."
- `tests/tool-signal.test.ts`: task_done tests pass.

**Verdict:** pass

---

### Criterion 12: pi-subagents-based functionality preserved
**Evidence:**
- `extensions/megapowers/plan-review/focused-review-runner.ts` imports:
  - `import { discoverAgents } from "pi-subagents/agents.js"`
  - `import { runSync } from "pi-subagents/execution.js"`
  - `import type { AgentConfig } from "pi-subagents/agents.js"`
  - `import type { SingleResult } from "pi-subagents/types.js"`
- `extensions/megapowers/plan-review/focused-review.ts` references `runtime: "pi-subagents"`.
- `extensions/megapowers/hooks.ts` imports and calls `runFocusedReviewFanout` from `plan-review/focused-review-runner.js`.
- `tests/focused-review-runner.test.ts` and `tests/hooks-focused-review.test.ts`: both pass.
- `extensions/megapowers/pi-subagents.d.ts`: ambient type declarations for `pi-subagents` retained.
- `pi-subagents` package is not removed from the dependency graph.

**Verdict:** pass

---

## Overall Verdict

**fail**

11 of 12 criteria pass. One criterion fails:

**AC8 failure:** `prompts/megapowers-protocol.md` line 33 contains the stale sentence "Pipeline/subagent worktrees are also managed automatically." This is an LLM-facing prompt template that describes the deleted legacy pipeline/subagent infrastructure as currently operational, which directly violates AC8. No test currently catches this stale reference.

**Required fix:** Remove or replace that trailing sentence from the Version Control section of `prompts/megapowers-protocol.md`. The sentence after "... `push-and-pr` and post-merge cleanup (`git checkout main`, `git pull`, `git branch -d`) are expected and should be executed directly." should have "Pipeline/subagent worktrees are also managed automatically." deleted entirely (since those worktrees no longer exist). Optionally add a test to `tests/prompts.test.ts` that asserts `megapowers-protocol.md` does not contain "Pipeline/subagent worktrees".
