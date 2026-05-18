# Verification Report — 129 Megapowers prompt and operation clarity

## Test Suite Results

Command run fresh:

```sh
git status --short && bun test
```

Observed output summary:

```text
bun test v1.3.14 (0d9b296a)
...
 863 pass
 0 fail
 2189 expect() calls
```

Targeted acceptance test command run fresh:

```sh
bun test tests/prompt-inject.test.ts tests/context-summary.test.ts tests/allowed-actions.test.ts tests/allowed-actions-parity.test.ts tests/feedback.test.ts tests/tool-signal.test.ts tests/tool-plan-task.test.ts tests/tool-plan-review.test.ts
```

Observed output summary:

```text
 214 pass
 0 fail
 630 expect() calls
Ran 214 tests across 8 files. [421.00ms]
```

Impact/dependency evidence requested before relying on tests:

- `symbol_graph(buildInjectedPrompt)` reported callers: `renderContextReport`, `onBeforeAgentStart`; callees include `buildIdlePrompt`, `buildCompactHeader`, `deriveAcceptanceCriteria`, template loading/interpolation, focused-review and source-issue helpers.
- `trace(onBeforeAgentStart, extensions/megapowers/hooks.ts)` reaches `buildInjectedPrompt`, `buildCompactHeader`, `getAllowedActions`, `loadPromptFile`, `getPhasePromptTemplate`, `interpolatePrompt`, `deriveToolInstructions`, `buildSourceIssuesContext`.
- `symbol_graph(handleSignal)` reported callers: `handlePhaseCommand`, `handleTaskCommand`, `registerTools`, `createUI` and callees: `handleTaskDone`, `handlePhaseNext`, `handlePhaseBack`, `handleTestsFailed`, `handleTestsPassed`, `handleCloseIssue`.
- `trace(registerTools, extensions/megapowers/register-tools.ts)` reaches `handleSignal`, `handlePlanDraftDone`, `handlePlanReview`, `handlePlanTask`, `composeMessage`, and state/plan store write paths.
- The `impact` tool itself was attempted for `buildInjectedPrompt`, `handleSignal`, `handlePlanTask`, and `handlePlanReview`, but rejected the supplied `changeType` values with schema-validation errors. I did not work around the tool; I used the available `symbol_graph`/`trace` evidence above and confirmed the surfaced dependents' tests ran in the full suite and targeted suite.

## Structural Evidence

Primary source anchors inspected:

- `extensions/megapowers/prompt-inject.ts:27-29` exports `renderFullProtocolPrompt()` loading `megapowers-protocol.md`.
- `extensions/megapowers/prompt-inject.ts:38-75` builds the compact idle prompt.
- `extensions/megapowers/prompt-inject.ts:125-171` builds the compact active header from `getAllowedActions`.
- `extensions/megapowers/prompt-inject.ts:173-330` assembles compact header, existing template vars, phase templates, derived tool instructions, and source issue context.
- `extensions/megapowers/workflows/allowed-actions.ts:24-84` is the shared allowed-action mapping.
- `extensions/megapowers/feedback.ts:6-35` exports the status vocabulary and `composeMessage` helper.
- `extensions/megapowers/tools/tool-signal.ts:142-360` uses `composeMessage` for task, test, phase, and close-issue success messages.
- `extensions/megapowers/tools/tool-plan-task.ts:80-144` includes task artifact paths and field change summaries.
- `extensions/megapowers/tools/tool-plan-review.ts:24-130` includes action-named errors, approve/revise result text, and plan artifact paths.
- `extensions/megapowers/plan-orchestrator.ts:96-149` composes `plan_draft_done` and revise-verdict messages.
- `docs/operation-feedback.md:1-65` documents vocabulary, message shape, errors, and conventions for new tools.

`ast_search` for `composeMessage($$$)` found the helper used in:

- `extensions/megapowers/tools/tool-signal.ts`
- `extensions/megapowers/tools/tool-plan-task.ts`
- `extensions/megapowers/tools/tool-plan-review.ts`
- `extensions/megapowers/plan-orchestrator.ts`

## Per-Criterion Verification

### Criterion 1: active prompt omits `## Megapowers Protocol`
**Evidence:** `tests/prompt-inject.test.ts:584-588`; targeted run shows pass: `does NOT include ## Megapowers Protocol for active issues (AC1)`. Source: `buildInjectedPrompt` pushes `buildCompactHeader` at `prompt-inject.ts:186-187`, not `renderFullProtocolPrompt`.
**Verdict:** pass

### Criterion 2: active prompt includes `## Megapowers`
**Evidence:** `tests/prompt-inject.test.ts:590-595`; targeted run pass: `includes ## Megapowers header and issue slug (AC2, AC4)`. Source `prompt-inject.ts:136-140` emits `## Megapowers`.
**Verdict:** pass

### Criterion 3: active phase name and plan-mode labels
**Evidence:** `tests/prompt-inject.test.ts:597-611`; source `prompt-inject.ts:134` computes `plan (${state.planMode})`, line 139 emits `Active phase: ${phaseLabel}`.
**Verdict:** pass

### Criterion 4: active issue slug
**Evidence:** `tests/prompt-inject.test.ts:590-595`; source `prompt-inject.ts:140` emits `Current issue: ${slug}`.
**Verdict:** pass

### Criterion 5: implement header includes current task index and description
**Evidence:** `tests/prompt-inject.test.ts:627-638`; source `prompt-inject.ts:143-148` derives tasks and emits `Current task: Task ${current.index}: ${current.description}`.
**Verdict:** pass

### Criterion 6: header lists only phase/mode allowed actions
**Evidence:** source `prompt-inject.ts:132-163` renders only `getAllowedActions(phase, state.planMode)` values; `allowed-actions.test.ts` cases all passed in targeted run.
**Verdict:** pass

### Criterion 7: active header includes state.json rule
**Evidence:** `tests/prompt-inject.test.ts:661-665`; source `prompt-inject.ts:168` emits `Do not edit .megapowers/state.json.`.
**Verdict:** pass

### Criterion 8: active header includes tool-error retry guidance
**Evidence:** `tests/prompt-inject.test.ts:661-666`; source `prompt-inject.ts:169` emits the retry guidance.
**Verdict:** pass

### Criterion 9: plan draft allowed actions and no phase_next bypass
**Evidence:** `tests/prompt-inject.test.ts:597-604`; source `allowed-actions.ts:24-32` lists `plan_draft_done`, `planTask: true`, and warning against forcing `phase_next`.
**Verdict:** pass

### Criterion 10: plan revise allowed actions and no phase_next bypass
**Evidence:** `tests/prompt-inject.test.ts:606-611`; source `allowed-actions.ts:34-41` lists revise-mode actions and warning.
**Verdict:** pass

### Criterion 11: plan review approve/revise, warnings against review_approve and phase_next
**Evidence:** `tests/prompt-inject.test.ts:614-625`; source `allowed-actions.ts:43-53` has `planReview: true` and warnings.
**Verdict:** pass

### Criterion 12: implement lists tests_failed/tests_passed/task_done
**Evidence:** `tests/prompt-inject.test.ts:627-635`; source `allowed-actions.ts:55-63`.
**Verdict:** pass

### Criterion 13: verify lists phase_next and phase_back
**Evidence:** `tests/prompt-inject.test.ts:640-645`; source `allowed-actions.ts:64-72`.
**Verdict:** pass

### Criterion 14: code-review lists phase_next and phase_back
**Evidence:** `tests/prompt-inject.test.ts:647-652`; source `allowed-actions.ts:64-72`.
**Verdict:** pass

### Criterion 15: done notes push/PR/cleanup and close_issue
**Evidence:** `tests/prompt-inject.test.ts:654-659`; source `allowed-actions.ts:73-80`.
**Verdict:** pass

### Criterion 16: deprecated review_approve not allowed
**Evidence:** `tests/allowed-actions.test.ts:53-60` and `tests/allowed-actions-parity.test.ts` pass; source has no `review_approve` signal action in `allowed-actions.ts`. Plan-review warning names it only as deprecated, not allowed.
**Verdict:** pass

### Criterion 17: phase templates still appended
**Evidence:** `tests/prompt-inject.test.ts:79-91`, `136-141`, `531-565`, `675-679`; source `prompt-inject.ts:280-304` loads plan/phase/done templates with `resolvePlanTemplate`/`getPhasePromptTemplate`/`loadPromptFile`.
**Verdict:** pass

### Criterion 18: workflow artifacts still load into template vars
**Evidence:** source `prompt-inject.ts:195-227` iterates `getWorkflowConfig(state.workflow).phases` and aliases; tests `prompt-inject.ts refactor verification` passed (`tests/prompt-inject.test.ts:417-426`).
**Verdict:** pass

### Criterion 19: acceptance criteria/current-task/learnings/roadmap vars preserved
**Evidence:** source `prompt-inject.ts:229-248`; tests for implement task vars and inline prompts passed (`tests/prompt-inject.test.ts:50-58`, `531-565`).
**Verdict:** pass

### Criterion 20: done vars preserved
**Evidence:** source `prompt-inject.ts:250-259` sets `learnings`, `files_changed`, `branch_name`, and `base_branch`; `prompt-inject.ts:296-303` sets `done_actions_list` and renders done template. Tests `tests/prompt-inject.test.ts:220-316` passed.
**Verdict:** pass

### Criterion 21: revise instructions and focused review artifacts preserved
**Evidence:** source `prompt-inject.ts:261-278`; tests `tests/prompt-inject.test.ts:167-190` and `484-515` passed.
**Verdict:** pass

### Criterion 22: advisory plan-review subagent section preserved and primary prompt skipped
**Evidence:** source `prompt-inject.ts:116-122` and `280-283`; test `tests/prompt-inject.test.ts:94-112` passed.
**Verdict:** pass

### Criterion 23: derived tool instructions appended except plan review
**Evidence:** source `prompt-inject.ts:306-318`; tests `tests/prompt-inject.test.ts:43-65`, `114-121`, `520-566` passed.
**Verdict:** pass

### Criterion 24: source issues context appended
**Evidence:** source `prompt-inject.ts:320-327` calls `buildSourceIssuesContext` when active issue has sources. Full suite including source-issue batch tests passed.
**Verdict:** pass

### Criterion 25: single allowed-action mapping and parity tests
**Evidence:** source `allowed-actions.ts:24-84`; compact header uses it at `prompt-inject.ts:132`; parity test file `tests/allowed-actions-parity.test.ts` passed all AC25/AC58 cases.
**Verdict:** pass

### Criterion 26: active prompt omits `## Open Issues`
**Evidence:** `tests/prompt-inject.test.ts:668-672` passed.
**Verdict:** pass

### Criterion 27: active prompt omits `## Available Commands`
**Evidence:** `tests/prompt-inject.test.ts:668-672` passed.
**Verdict:** pass

### Criterion 28: no-active prompt heading and line
**Evidence:** `tests/prompt-inject.test.ts:688-693` passed; source `prompt-inject.ts:38-43`.
**Verdict:** pass

### Criterion 29: no-active prompt lists `/issue list`, `/issue new`, `/triage`
**Evidence:** `tests/prompt-inject.test.ts:695-701` passed; source `prompt-inject.ts:44-47`.
**Verdict:** pass

### Criterion 30: no-active prompt includes state rule and error guidance
**Evidence:** `tests/prompt-inject.test.ts:703-708` passed; source `prompt-inject.ts:49-51`.
**Verdict:** pass

### Criterion 31: no-active prompt compact open issues list filtered
**Evidence:** `tests/prompt-inject.test.ts:710-722` passed; source `prompt-inject.ts:56-65` filters non-done/non-archived and formats `- #NNN title (milestone: ..., priority: ...)`.
**Verdict:** pass

### Criterion 32: no-active prompt omits full protocol
**Evidence:** `tests/prompt-inject.test.ts:724-728` passed.
**Verdict:** pass

### Criterion 33: exported full protocol renderer
**Evidence:** source `prompt-inject.ts:27-29`; test `tests/prompt-inject.test.ts:569-576` passed.
**Verdict:** pass

### Criterion 34: debug context report includes compact header
**Evidence:** `tests/context-summary.test.ts:192-202` passed; `buildInjectedPrompt` caller evidence from `symbol_graph` names `renderContextReport`.
**Verdict:** pass

### Criterion 35: renderer reachable from tests
**Evidence:** import at `tests/prompt-inject.test.ts:5`; test at `569-576` passed.
**Verdict:** pass

### Criterion 36: signal success messages begin with shared vocabulary icon
**Evidence:** `tests/tool-signal.test.ts` targeted run passed named cases for `task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `plan_draft_done`, `close_issue`; source `feedback.ts:6-35`, `tool-signal.ts:142-360`, `plan-orchestrator.ts:100-104`.
**Verdict:** pass

### Criterion 37: task_done message names task, remaining count, next task/verify
**Evidence:** `tests/tool-signal.test.ts` targeted run passed `task_done success message... (AC36, AC37)` and final-task case; source `tool-signal.ts:143-170`.
**Verdict:** pass

### Criterion 38: phase_next names new phase and next step
**Evidence:** `tests/tool-signal.test.ts` targeted run passed `phase_next success message uses 📋 icon... (AC36, AC38)`; source `tool-signal.ts:266-273`.
**Verdict:** pass

### Criterion 39: phase_back names new phase and rework next step
**Evidence:** targeted run passed `phase_back success message uses ⚠️... (AC36, AC39)`; source `tool-signal.ts:319-327`.
**Verdict:** pass

### Criterion 40: tests_failed states RED and production writes allowed
**Evidence:** targeted run passed `tests_failed success message... (AC36, AC40)`; source `tool-signal.ts:197-203`.
**Verdict:** pass

### Criterion 41: tests_passed states GREEN recorded
**Evidence:** targeted run passed `tests_passed success message... (AC36, AC41)`; source `tool-signal.ts:217-222`.
**Verdict:** pass

### Criterion 42: plan_draft_done count and review transition
**Evidence:** targeted run passed `plan_draft_done success message... (AC36, AC42)`; source `plan-orchestrator.ts:96-104` and `tool-signal.ts:229-251`.
**Verdict:** pass

### Criterion 43: close_issue names slug and source count
**Evidence:** targeted run passed close_issue message cases `(AC36, AC43)`; source `tool-signal.ts:351-359`.
**Verdict:** pass

### Criterion 44: plan_task create message id/title/path/fields
**Evidence:** targeted run passed `create success uses shared ✅ icon... (AC44, AC50)`; source `tool-plan-task.ts:80-88`.
**Verdict:** pass

### Criterion 45: plan_task update message id/title/path/changed fields/no changes
**Evidence:** targeted run passed update message cases `(AC45, AC50, AC51)`; source `tool-plan-task.ts:137-144`.
**Verdict:** pass

### Criterion 46: plan_task errors identify action and corrective action
**Evidence:** targeted run passed create/update/corrupt error cases `(AC46)`; source `tool-plan-task.ts:35-67`, `130-133`.
**Verdict:** pass

### Criterion 47: plan_review revise message iteration/IDs/next step
**Evidence:** targeted run passed `revise message includes iteration... (AC47)`; source `plan-orchestrator.ts:141-149`.
**Verdict:** pass

### Criterion 48: plan_review approve message iteration/count/plan.md/next step
**Evidence:** targeted run passed approve message `(AC48, AC51)`; source `tool-plan-review.ts:121-128`.
**Verdict:** pass

### Criterion 49: plan_review errors identify action and corrective action
**Evidence:** targeted run passed iteration cap, missing revise-instructions, wrong-phase error cases `(AC49)`; source `tool-plan-review.ts:27-47`, `plan-orchestrator.ts:122-129`.
**Verdict:** pass

### Criterion 50: shared helper module and adoption
**Evidence:** source `feedback.ts:6-35`; `ast_search composeMessage($$$)` found use in signal, plan task, plan review, and plan orchestrator; `tests/feedback.test.ts` passed.
**Verdict:** pass

### Criterion 51: plan writes include relative artifact path
**Evidence:** source `tool-plan-task.ts:80-88`, `137-144`, `tool-plan-review.ts:121-128`; targeted tests for AC44/45/48/51 passed.
**Verdict:** pass

### Criterion 52: structured result fields preserved
**Evidence:** source continues returning `{ message }`, `{ error }`, `{ triggerNewSession }` in `tool-signal.ts`, `tool-plan-task.ts`, `tool-plan-review.ts`; full suite passed existing integration and wiring tests.
**Verdict:** pass

### Criterion 53: docs page
**Evidence:** `docs/operation-feedback.md:1-65` documents vocabulary, message shape, errors, and adoption steps.
**Verdict:** pass

### Criterion 54: prompt-inject test coverage minimum
**Evidence:** targeted run shows all named `tests/prompt-inject.test.ts` compact/default/per-phase/template/absence tests passed.
**Verdict:** pass

### Criterion 55: no-active-issue prompt tests
**Evidence:** targeted run passed `buildInjectedPrompt — compact no-active-issue prompt` cases at `tests/prompt-inject.test.ts:683-728`.
**Verdict:** pass

### Criterion 56: full protocol renderer test
**Evidence:** targeted run passed `renderFullProtocolPrompt` at `tests/prompt-inject.test.ts:569-576`.
**Verdict:** pass

### Criterion 57: context debug prompt test
**Evidence:** targeted run passed `debug report's rendered prompt section contains the compact ## Megapowers header (AC34)` at `tests/context-summary.test.ts:192-202`.
**Verdict:** pass

### Criterion 58: allowed-action parity test
**Evidence:** targeted run passed all `tests/allowed-actions-parity.test.ts` cases.
**Verdict:** pass

### Criterion 59: tool-signal message shape tests
**Evidence:** targeted run passed all relevant `tests/tool-signal.test.ts` AC36-AC43 cases.
**Verdict:** pass

### Criterion 60: tool-plan-task message shape tests
**Evidence:** targeted run passed all relevant `tests/tool-plan-task.test.ts` AC44-AC46 cases.
**Verdict:** pass

### Criterion 61: tool-plan-review message shape tests
**Evidence:** targeted run passed all relevant `tests/tool-plan-review.test.ts` AC47-AC49 cases.
**Verdict:** pass

### Criterion 62: focused-review/advisory subagent tests still pass
**Evidence:** full suite passed `tests/focused-review.test.ts`, `tests/focused-review-runner.test.ts`, and `tests/hooks-focused-review.test.ts`; targeted prompt tests for advisory/focused-review rendering also passed.
**Verdict:** pass

### Criterion 63: `bun test` passes
**Evidence:** fresh full run output: `863 pass`, `0 fail`, `2189 expect() calls`.
**Verdict:** pass

## Overall Verdict

pass

All acceptance criteria are supported by fresh test output plus source/trace evidence. The only verification-process limitation was the `impact` tool rejecting supplied `changeType` values; I recorded that failure and used `symbol_graph`/`trace` evidence to enumerate downstream paths and confirm the associated tests ran.