# Verification — #130

## Test Suite Results

Fresh commands executed during verification, using the runner documented in AGENTS.md:59:

```text
$ bun test
bun test v1.3.14 (0d9b296a)
868 pass
0 fail
2735 expect() calls
Ran 868 tests across 85 files. [1.64s]
```

Exit 0. Read the complete 1,045-line output in three ranges; independently counted 868 `(pass)` lines and zero `(fail)` lines. Full original output: `/var/folders/gw/8yg8rbgd0r7fx_7mlssdcg6c0000gn/T/pi-bash-ec28616df8accd08.log`.

Fresh focused reruns:

```text
$ bun test tests/tool-session-transcript.test.ts tests/new-session-wiring.test.ts tests/register-tools.test.ts tests/index-integration.test.ts
18 pass
0 fail
559 expect() calls
Ran 18 tests across 4 files. [1385.00ms]
```

```text
$ bun test tests/tool-signal.test.ts tests/tool-plan-review.test.ts tests/gates.test.ts tests/phase-advance.test.ts tests/hooks.test.ts tests/plan-orchestrator.test.ts tests/tools.test.ts tests/tool-plan-task.test.ts tests/version-artifact.test.ts tests/create-issue-tool-validation.test.ts tests/create-issue-tool-success.test.ts tests/bugfix-integration.test.ts
209 pass
0 fail
584 expect() calls
Ran 209 tests across 12 files. [810.00ms]
```

Both exit 0. `bun --version` returned `1.3.14`; `pi --version` returned `0.99.2`. `git diff --check` exited 0 without output. No build script is declared in package.json; no separate build/typecheck success is claimed.

### Downstream impact and execution-path evidence

Fresh `impact({symbols:["registerTools"], changeType:"behavior_change", maxDepth:3})` returned:

```text
Trust: fresh
No dependents found — 'registerTools' is an entry point with no callers.
```

This index misses the explicit bootstrap call. Structural search `ast_search({pattern:"registerTools($$$ARGS)", lang:"typescript", path:"extensions"})` returned:

```text
extensions/megapowers/index.ts
42:873|  registerTools(pi, runtimeDeps);
```

The downstream bootstrap's `tests/index-integration.test.ts` ran in the full suite and the focused 18-test rerun. Registration behavior ran in `tests/register-tools.test.ts` and both transcript suites. Secondary impact on handleSignal, handlePlanReview, transitionDraftToReview, and transitionReviewToRevise returned:

```text
Trust: fresh
extensions/megapowers/register-tools.ts 13:f7d registerTools behavioral depth:1
[fan-in:0, fan-out:8, roles:entry-point, coverage:untested, chain-confidence:0.90]
```

That surfaced dependent's tests also ran. Graph `untested` annotations are not runtime coverage measurements here; actual Bun output establishes which tests ran.

`trace({entry:"megapowers", file:"extensions/megapowers/index.ts"})` is explicitly static/heuristic and listed bootstrap hooks including onBeforeAgentStart, but omitted registerTools. Follow-up `trace({entry:"registerTools", file:"extensions/megapowers/register-tools.ts"})` included these relevant lines:

```text
Trust: fresh
mode: static (heuristic, no runtime evidence)
extensions/megapowers/register-tools.ts 13:f7d registerTools function [entry-point, untested]
extensions/megapowers/tools/tool-plan-review.ts 23:b6d handlePlanReview function [untested]
extensions/megapowers/plan-orchestrator.ts 109:25c transitionReviewToRevise function [untested]
extensions/megapowers/tools/tool-plan-review.ts 87:496 handleApproveVerdict function [untested]
extensions/megapowers/tools/tool-signal.ts 19:30b handleSignal function [untested]
extensions/megapowers/tools/tool-signal.ts 62:f7c handleTaskDone function [untested]
extensions/megapowers/tools/tool-signal.ts 257:d97 handlePhaseNext function [untested]
extensions/megapowers/policy/phase-advance.ts 15:042 advancePhase function [untested]
extensions/megapowers/tools/tool-signal.ts 275:1ee handlePhaseBack function [untested]
extensions/megapowers/tools/tool-signal.ts 226:5ca handlePlanDraftDone function [untested]
```

This is a static path excerpt, not evidence of host callback dispatch. Anchored index.ts:42 connects bootstrap to registration; the fresh live smoke below explicitly loads index.ts into a new Pi process and exercises a model-issued transition, follow-up read, and final provider reply through the real entry point.

## Reproduction: original symptom and fixed behavior

Executed the complete shell block in `docs/session-compatibility.md:16–94`, with `PI_SESSION_MANAGER_MODULE=/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js`. It persists the assistant call before registered execute(), persists the tool result afterward, and projects the real installed manager's canonical messages.

Also ran an isolated pre-fix control against HEAD versions of the four affected runtime files. A Bun in-memory loader supplied `git show HEAD:<path>` source for register-tools.ts, tool-signal.ts, tool-plan-review.ts, and plan-orchestrator.ts; all other modules were unchanged. No checkout, source modification, active-session reset, or provider request occurred in the control. The loader used:

```ts
import { plugin } from "bun";
import { execFileSync } from "node:child_process";
const baselineFiles = new Set([
  "extensions/megapowers/register-tools.ts",
  "extensions/megapowers/tools/tool-signal.ts",
  "extensions/megapowers/tools/tool-plan-review.ts",
  "extensions/megapowers/plan-orchestrator.ts",
]);
plugin({ name: "isolated-head-baseline", setup(build) {
  build.onLoad({ filter: /\/(register-tools|tool-signal|tool-plan-review|plan-orchestrator)\.ts$/ }, ({path}) => {
    const relative = path.slice(process.cwd().length + 1);
    if (!baselineFiles.has(relative)) return;
    return {
      contents: execFileSync("git", ["show", "HEAD:" + relative], {encoding:"utf8"}),
      loader: "ts",
    };
  });
} });
const { registerTools } = await import("./extensions/megapowers/register-tools.ts");
```

This replaces only the registration import in the documented smoke command. Exact fresh control output, exit 1:

```json
{"mode":"offline","phase":"spec","sessionIdChanged":true,"orphaned":["call_compatibility_smoke"],"errors":[]}
```

```text
error: Session compatibility smoke failed
```

Identical installed-manager smoke with current source, exit 0:

```json
{"mode":"offline","phase":"spec","sessionIdChanged":false,"orphaned":[],"errors":[]}
```

Both advanced the workflow successfully; only the pre-fix implementation erased the originating call. This freshly reproduces the diagnosis's storage/persistence boundary and confirms it no longer corrupts projected context. The original two regressions also passed freshly:

```text
(pass) phase_next preserves the originating call when Pi persists its result
(pass) task_done preserves the originating call when Pi persists its result
```

The earlier exact regression RED output is recorded in reproduce.md:189–236. Verification freshly repeated the real-manager smoke's RED/GREEN control, not a baseline run of the entire Bun suite.

## Per-Criterion Verification

### Criterion 1: No unsafe session reset/replacement in transition callbacks or relocated hooks

**Evidence:** Read register-tools.ts and hooks.ts completely; reviewed the runtime diff. `ast_search` for `$OBJ.newSession($$$ARGS)` across `extensions` returned `No matches found`. `grep` for `triggerNewSession|newSession` across `extensions` returned `[0 matches in 0 files]`, also covering optional-call syntax and lifecycle code.

Fresh symbol_graph source/contract evidence:

```text
## registerTools (function)
extensions/megapowers/register-tools.ts 13:f7d
Signature: (pi: ExtensionAPI, runtimeDeps: RuntimeDeps) => void
Callees: handlePlanDraftDone, handleSignal, readState, handlePlanTask, handlePlanReview (+3 more)
Guards: result.error; result.error; result.error; "error" in result; "error" in result
```

Anchored execute source:

```text
36:e0f| result = await handlePlanDraftDone(ctx.cwd);
38:efe| result = handleSignal(ctx.cwd, params.action, params.target);
40:b97| if (result.error) {
41:d77|   return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
43:8bc| // Workflow transitions preserve the current Pi session.
49:3cd| return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
90:664| const result = handlePlanReview(ctx.cwd, params);
91:b97| if (result.error) {
92:d77|   return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
94:8bc| // Workflow transitions preserve the current Pi session.
96:3cd| return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
```

Hooks remain state/context/dashboard handlers without a relocated session mutation. The 56-fixture test's ctx.newSession throws if invoked; all fixtures pass with zero raw resets.

**Verdict:** pass.

### Criterion 2: All affected successful paths preserve call/result pairing and continuation

**Evidence:** Fresh 18-test rerun passed the original reproduction and replacement wiring matrix. `tests/new-session-wiring.test.ts:16–30` defines phase_next, phase_back, task-next, task-final, draft-done, revise-done, review-approve, review-revise, and control/error cases. Lines 63–110 exercise four layouts for each of 14 cases, totaling 56 fixtures. Lines 98 and 112–128 require actual expected success and resulting workflow state, not merely absence of an orphan on a rejected operation.

```text
(pass) transition tool persistence > preserves tool pairing for every transition across direct, batch, and nested layouts
```

Fresh symbol_graph cards:

```text
## handleSignal (function)
extensions/megapowers/tools/tool-signal.ts 19:30b
(cwd: string, action: "task_done" | "phase_next" | "phase_back" | "tests_failed" |
 "tests_passed" | "plan_draft_done" | "close_issue" | string, target?: string) => SignalResult
Callers: registerTools
Callees: readState, handleTaskDone, handlePhaseNext, handlePhaseBack, handleTestsFailed (+2 more)
Guard: !state.megaEnabled

## handlePlanReview (function)
extensions/megapowers/tools/tool-plan-review.ts 23:b6d
(cwd: string, params: PlanReviewParams) => PlanReviewResult
Callers: registerTools
Callees: readState, composeMessage, transitionReviewToRevise, writeState, writePlanReview (+2 more)
Guards: state.phase !== "plan"; state.planMode !== "review"; !existsSync(filepath); !orchestrated.ok
```

The real-entry OpenAI smoke below confirms failure-free provider continuation after phase_next; the other success paths have offline persistence/state coverage, not separate live-provider runs.

**Verdict:** pass.

### Criterion 3: Workflow gates, sequencing, backward artifacts, and plan-review effects remain correct

**Evidence:** Fresh 209-test domain/gate/artifact rerun exited 0. Its output explicitly includes TDD null/stale-task rejection, skip exceptions, next/final task completion, skipping completed tasks, explicit backward targets, verify/code-review artifact versioning, revise cap rejection without artifact/status writes, revision iteration/status updates, approval plan.md generation, and implement advance. The full suite additionally ran write-policy, gate-evaluator, legacy-plan-bridge, and state-machine tests.

Matrix lines 114–128 independently assert completedTasks `[1]`, cleared tddTaskState, next index, revision iteration 2, approved/needs_revision status, review-001.md, and verify.v1.md.

The handleSignal/handlePlanReview cards above confirm domain handlers remain reachable. Source inspection verifies `handlePhaseNext` still calls advancePhase (tool-signal.ts:257–268), phase_back still versions artifacts before advancePhase (:298–309), draft submission still validates and persists (:226–247), review revision still writes review/status/state (tool-plan-review.ts:61–77), and approval still generates plan.md and writes next state (:87–119). Runtime diff changes only reset metadata/consumption, descriptions, and two next-step strings; it does not remove validation or state effects.

**Verdict:** pass.

### Criterion 4: Mixed batches and nested outer pairs survive

**Evidence:** Fresh matrix output passed. `tests/new-session-wiring.test.ts:80–110` persists one assistant containing transition plus sibling calls, exercises both sibling-result orders, and uses only the outer codemode call/result pair for nested execution. It requires all original IDs to equal all result IDs, no orphan results, user/assistant preservation, and resets `0`:

```text
107:fad| expect(resultIds.filter(id => !ids.has(id))).toEqual([]);
108:877| expect([...ids].sort()).toEqual(resultIds.slice().sort());
109:fe7| expect(projected.slice(0, 2).map(m => m.role)).toEqual(["user", "assistant"]);
110:121| expect(resets).toBe(0);
```

The registerTools card and execute source under Criterion 1 are the affected symbol evidence. No callback touches transcript storage, so protection is not limited to the nested call ID. This is a pure persistence-boundary model, not a live codemode/provider batch test.

**Verdict:** pass.

### Criterion 5: Validation errors, non-transition signals, and other registrations remain intact

**Evidence:** Matrix cases :25–30 cover phase/TDD/review-gate errors, tests_failed, tests_passed, and close_issue through actual registered callbacks in all four layouts. Lines 70–72 require all five registrations: create_batch, create_issue, megapowers_plan_review, megapowers_plan_task, megapowers_signal.

The 209-test rerun passed signal error/TDD/close-source-issue behavior, plan-task create/update/lint behavior, create_issue validation/success, and all five createBatchHandler tests. The 18-test rerun passed registration/schema invariants. Anchored source register-tools.ts:55–75, :103–127, and :130–151 retains plan-task/issue/batch execute logic. The registerTools card under Criterion 1 includes those handler callees and unchanged error guards.

**Verdict:** pass.

### Criterion 6: Original regressions pass, unsafe assertions replaced, pure tests plus real-manager smoke

**Evidence:** Fresh original reproduction cases passed (18-test rerun and full suite). Read both transcript test files: they use local persistence fakes and temporary workflow fixtures, not the installed Pi manager. The old reset-required expectations have been replaced by the 56-fixture behavioral matrix with complete call/result-set equality and zero resets. Domain tests now assert absence of triggerNewSession metadata.

The registerTools source/card in Criterion 1 and fresh installed-manager RED/GREEN outputs in the reproduction section establish the relevant callback shape and actual host storage semantics separately. The external installed-manager import occurs only in the isolated documented smoke, not in repository unit tests. All smoke fixtures were removed in finally and never pointed at the active project/session.

**Verdict:** pass.

### Criterion 7: Explicit, truthful clean-context policy and current state at next agent start

**Evidence:** Read plan-overview.md:3–5, README.md:68–82, AGENTS.md:18 and :55, and the complete superseded #080 document. They explicitly choose current-session preservation and user-initiated `/new` between runs, not automatic handoff. README:80 and #080:12 explicitly distinguish next agent start from follow-up requests inside a run. Tool descriptions at register-tools.ts:19 and :82 state preservation. Orchestrator next steps at plan-orchestrator.ts:103 and :148 instruct continuation in the current session. Searches of current extension code and prompts found no remaining automatic new-session promise; historical research and past issue/plan artifacts are not current runtime guidance.

Fresh symbol_graph and source evidence:

```text
## onBeforeAgentStart (function)
extensions/megapowers/hooks.ts 65:f02
(_event: any, ctx: any, deps: Deps) => Promise<any>
Callers: megapowers
Callees: preparePlanReviewContext, buildContextSummary, formatCompactContextStatus
Guard: !prompt

67:78d| await preparePlanReviewContext(ctx.cwd);
68:a66| const prompt = buildInjectedPrompt(ctx.cwd, store);
79:3b4| content: prompt,

## transitionDraftToReview (function)
extensions/megapowers/plan-orchestrator.ts 81:8de
(state: MegapowersState, taskCount: number) => OrchestratorResult<PlanTransitionResult>
Guards: state.phase !== "plan"; state.planMode !== "draft" && state.planMode !== "revise"

## transitionReviewToRevise (function)
extensions/megapowers/plan-orchestrator.ts 109:25c
(state: MegapowersState, approvedIds: number[], needsRevisionIds: number[], maxIterations: number)
 => OrchestratorResult<PlanTransitionResult>
Callers: handlePlanReview
Guards: state.planMode !== "review"; state.planIteration >= maxIterations
```

All 56 fixtures invoke the subsequent onBeforeAgentStart and assert the new phase/no-active-issue context (:129–132). An additional fresh real-manager task_done smoke used a two-task plan and impl-allowed TDD fixture, then invoked onBeforeAgentStart and asserted `Current task: Task 2: Second`. Exact output, exit 0:

```json
{"currentTaskIndex":1,"completedTasks":[1],"contextHasNextTask":true}
{"mode":"offline","phase":"implement","sessionIdChanged":false,"orphaned":[],"errors":[]}
```

No-test Task 5 is documentation-only: its read/search verification was performed and bun test passed. No-test Task 6's complete documented command ran successfully offline and with OpenAI; the Anthropic limitation is recorded below. A runtime unit test is not applicable to documentation prose or external-provider quota.

**Verdict:** pass.

### Criterion 8: Fresh supported session continues without orphan error/restart; provider limitations reported

**Evidence:** Started the documented smoke using the process manager, in a disposable cwd, loading the fixed extension through its real index.ts entry point:

```text
MEGA_SMOKE_MODEL=openai-codex/gpt-5.5 <complete docs/session-compatibility.md shell command>
```

Process `proc_904e` exited 0 after 12 seconds. Exact output:

```json
{"mode":"openai-codex/gpt-5.5","phase":"spec","sessionIdChanged":false,"orphaned":[],"errors":[]}
```

The command requires exactly one megapowers_signal result, a subsequent read result, final `SESSION_SMOKE_OK`, one persisted session, expected phase, and no assistant errors or orphan results. This is a live OpenAI Codex pass with the fixed extension loaded, not merely an offline pairing check. Source/card and entry trace limitations are recorded above; this child process supplies real host-dispatch evidence.

Also attempted:

```text
MEGA_SMOKE_MODEL=anthropic/claude-haiku-4-5 <same complete shell command>
```

Process `proc_bd6e` exited 1 after 4 seconds. Provider response:

```text
400 {"type":"error","error":{"type":"invalid_request_error","message":"You're out of extra usage. Add more at claude.ai/settings/usage and keep going."},"request_id":"req_011Cfbxs6HJkcAxWsAq6K4ot"}
```

This is a quota-blocked live attempt, NOT an Anthropic pass and not an orphan-call rejection. No Anthropic transition/continuation was validated. The isolated run also warned about global anthropic-cc model patterns not matching when that provider extension was disabled. No credentials were printed or modified. Both fixtures were cleaned up; the active session was not replaced.

**Verdict:** pass for available live OpenAI continuation and honest limitation reporting; live Anthropic behavior remains unverified due to quota. Criterion 8 explicitly permits reporting provider smoke limitations.

## Overall Verdict

**pass**

All eight criteria have inspected-source, fresh test, and/or fresh host evidence. The original corruption reproduces against pre-fix HEAD and disappears with current source using the real installed manager; live OpenAI Codex continues through a transition, subsequent tool, and final reply without restart. Anthropic live verification is blocked by quota and is not claimed as passing. Historical transcript repair, automatic context handoff, and provider-wide live coverage of every transition/batch layout remain outside the demonstrated scope.

Verification made no production changes, no direct state.json edits, and no reset of the active session. Existing unrelated working-tree changes were left intact.
