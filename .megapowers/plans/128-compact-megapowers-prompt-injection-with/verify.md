# Verification Report

## Test Suite Results

### Full suite (fresh)
Command: `bun test`

Output evidence:
- Full raw output: `/var/folders/gw/8yg8rbgd0r7fx_7mlssdcg6c0000gn/T/pi-bash-b71e58bb87587826.log`
- Guarded preview reported: `804 pass`, `0 fail`, `1984 expect() calls`.
- Tail of command output:

```text
(pass) deriveToolInstructions > returns write + path + phase_next for reproduce phase (has artifact) [0.01ms]
(pass) deriveToolInstructions > returns write + path + phase_next for code-review phase (artifact + tdd) [0.01ms]

...
(pass) handlePlanTask — T0 lint integration > allows valid task to be saved [3.14ms]

...
(pass) preparePlanReviewContext > soft-fails when focused review fan-out throws so review can still proceed [2.12ms]

 804 pass
 0 fail
 1984 expect() calls
```

### Focused suite for changed behavior (fresh)
Command: `bun test tests/context-summary.test.ts tests/hooks.test.ts tests/commands-context.test.ts tests/mp-command.test.ts`

Output:

```text
bun test v1.3.14 (0d9b296a)

tests/commands-context.test.ts:
(pass) /mega context > renders default and debug context reports without mutating state [6.09ms]

tests/hooks.test.ts:
(pass) onAgentEnd — done-phase doneActions cleanup > populates doneActions (and sets doneChecklistShown) when in done phase with empty doneActions [4.05ms]
(pass) onAgentEnd — done-phase doneActions cleanup > does nothing when not in done phase [0.54ms]
(pass) onAgentEnd — done-phase doneActions cleanup > hooks.ts does not contain done-phase action processing or text scraping [0.23ms]
(pass) onAgentEnd — done-phase doneActions cleanup > onAgentEnd in done phase with doneActions does not consume actions (prompt context only) [0.45ms]
(pass) handlePhaseBack — no intermediate state write > tool-signal.ts does not contain a redundant intermediate writeState in handlePhaseBack [0.09ms]
(pass) hooks.ts no longer imports jj availability helpers/messages [0.03ms]
(pass) onAgentEnd — deferred done checklist (#083) > calls showDoneChecklist when phase=done, doneActions=[], hasUI=true, doneChecklistShown=false [0.91ms]
(pass) onAgentEnd — deferred done checklist (#083) > does NOT call showDoneChecklist when doneChecklistShown=true [0.41ms]
(pass) onAgentEnd — deferred done checklist (#083) > auto-populates defaults in headless mode (hasUI=false) via showDoneChecklist [0.75ms]
(pass) onBeforeAgentStart — compact context status > keeps hidden megapowers-context injection and updates TUI status without notifications [1.95ms]

tests/context-summary.test.ts:
(pass) context summary derivation > derives workflow, phase, plan mode, task progress, artifacts, and active tool guidance without storing derived prompt text [0.95ms]
(pass) context summary source diagnostics > does not keep an unused cwd parameter in deriveGuidance [0.05ms]
(pass) context inspection report > renders metadata, active guidance, task/TDD state, and artifact availability without the full prompt [4.40ms]
(pass) context inspection debug report > includes an explicit rendered prompt section only in debug mode [0.97ms]

tests/mp-command.test.ts:
(pass) /mp command hub dispatch > /mp with no args dispatches to help (same as /mp help) [0.25ms]
(pass) /mp command hub dispatch > unknown subcommand dispatches to help (same as /mp help) [0.07ms]
(pass) /mp command hub dispatch > dispatch is case-insensitive for subcommand matching [0.05ms]
(pass) /mp argument completions > returns completions for all registered subcommand names [0.54ms]
(pass) /mp is registered in index.ts > registers a single /mp command [0.07ms]
(pass) /mp context > renders the same default and debug context report through the /mp registry [1.76ms]

 21 pass
 0 fail
 90 expect() calls
Ran 21 tests across 4 files. [558.00ms]
```

## Downstream/Reachability Evidence

### Impact/dependent scan
Required `impact` tool was attempted for `renderContextReport`, `onBeforeAgentStart`, `handleMegaCommand`, and `createMpRegistry`, but the tool rejected multiple documented-style `changeType` values (`behavior`, `modify`, `behavior-change`, `logic`, `implementation`, `semantic`) with schema validation errors. I used `symbol_graph` and `trace` below as the successful dependent/reachability evidence.

### `symbol_graph`: `renderContextReport`

```text
## renderContextReport (function)
extensions/megapowers/context-summary.ts  140:db3
Signature: (cwd: string, store?: Store, options?: { debug?: boolean }) => string
Callers (2): handleMegaCommand, createMpRegistry
Callees (3): buildContextSummary, formatList, buildInjectedPrompt
Source anchors:
140:db3 export function renderContextReport(cwd: string, store?: Store, options?: { debug?: boolean }): string {
147:646   `Workflow: ${summary.workflow ?? "none"}`,
148:1af   `Phase: ${summary.phase ?? "none"}`,
151:5e2   if (summary.phase === "plan" && summary.planMode) {
152:a9e     lines.push(`Plan mode: ${summary.planMode}`);
157:476   if (summary.taskProgress) {
158:fe3     lines.push(`Current task: ${summary.taskProgress.current}/${summary.taskProgress.total}`);
160:81a     lines.push(`TDD state: ${summary.taskProgress.tddState ?? "none"}`);
167:3ef   lines.push("## Artifacts");
169:4e6   lines.push(...formatList("Available artifacts", summary.artifacts.available));
173:855   lines.push("## Tool guidance");
179:c50   if (options?.debug) {
181:3ac     lines.push("## Rendered prompt");
182:cac     lines.push(buildInjectedPrompt(cwd, store) ?? "No rendered prompt available.");
```

### `symbol_graph`: `onBeforeAgentStart`

```text
## onBeforeAgentStart (function)
extensions/megapowers/hooks.ts  65:f02
Signature: (_event: any, ctx: any, deps: Deps) => Promise<any>
Callees (4): preparePlanReviewContext, buildInjectedPrompt, buildContextSummary, formatCompactContextStatus
Source anchors:
68:a66 const prompt = buildInjectedPrompt(ctx.cwd, store);
69:5c1 if (!prompt) return;
71:b61 if (ctx.hasUI && ctx.ui?.setStatus) {
72:9d9   const summary = buildContextSummary(ctx.cwd, store);
73:991   ctx.ui.setStatus(formatCompactContextStatus(summary));
76:14a return {
78:31b   customType: "megapowers-context",
79:3b4   content: prompt,
80:874   display: false,
```

### `symbol_graph`: `handleMegaCommand`

```text
## handleMegaCommand (function)
extensions/megapowers/commands.ts  30:cf6
Signature: (args: string, ctx: any, deps: Deps) => Promise<void>
Callees include: renderContextReport, writeState, readState
Source anchors:
33:a61 if (sub === "context" || sub === "context debug") {
34:c1a   const report = renderContextReport(ctx.cwd, deps.store, { debug: sub === "context debug" });
35:aaf   if (ctx.hasUI) ctx.ui.notify(report, "info");
36:d32   return;
```

### `symbol_graph`: `createMpRegistry`

```text
## createMpRegistry (function)
extensions/megapowers/mp/mp-handlers.ts  78:323
Signature: (deps: Deps) => MpRegistry
Callees include: renderMpHelp, buildMpNewInjectPrompt, handleMegaCommand, renderContextReport, comingSoonHandler
Source anchors:
120:3ab registry.context = {
121:c76   tier: "programmatic",
122:d23   description: "Inspect current derived Megapowers context",
123:249   execute: async (args: string, ctx: ExtensionCommandContext) => {
124:02c     return renderContextReport(ctx.cwd, deps.store, { debug: args.trim().toLowerCase() === "debug" });
```

### Structural search evidence

`ast_search` for `ctx.ui.setStatus($ARG)`:

```text
--- extensions/megapowers/hooks.ts ---
>>73:991|    ctx.ui.setStatus(formatCompactContextStatus(summary));
```

`ast_search` for `renderContextReport($$$ARGS)`:

```text
--- extensions/megapowers/commands.ts ---
>>34:c1a|    const report = renderContextReport(ctx.cwd, deps.store, { debug: sub === "context debug" });
--- extensions/megapowers/mp/mp-handlers.ts ---
>>124:02c|      return renderContextReport(ctx.cwd, deps.store, { debug: args.trim().toLowerCase() === "debug" });
```

### Trace evidence

`trace` from `onBeforeAgentStart` confirms the hook entry path reaches `buildContextSummary`, `deriveArtifacts`, `deriveTaskProgress`, `deriveGuidance`, `formatCompactContextStatus`, and `buildInjectedPrompt`:

```text
extensions/megapowers/hooks.ts 65:f02 onBeforeAgentStart
extensions/megapowers/context-summary.ts 112:f62 buildContextSummary
extensions/megapowers/context-summary.ts 50:354 deriveArtifacts
extensions/megapowers/context-summary.ts 70:b5c deriveTaskProgress
extensions/megapowers/context-summary.ts 93:b02 deriveGuidance
extensions/megapowers/context-summary.ts 127:b61 formatCompactContextStatus
extensions/megapowers/prompt-inject.ts 106:0b7 buildInjectedPrompt
```

`trace` from `handleMegaCommand` confirms `/mega` command path reaches `renderContextReport`, which reaches `buildContextSummary`, `deriveArtifacts`, `deriveTaskProgress`, `deriveGuidance`, and debug `buildInjectedPrompt`:

```text
extensions/megapowers/commands.ts 30:cf6 handleMegaCommand
extensions/megapowers/context-summary.ts 140:db3 renderContextReport
extensions/megapowers/context-summary.ts 112:f62 buildContextSummary
extensions/megapowers/context-summary.ts 50:354 deriveArtifacts
extensions/megapowers/context-summary.ts 70:b5c deriveTaskProgress
extensions/megapowers/context-summary.ts 93:b02 deriveGuidance
extensions/megapowers/prompt-inject.ts 106:0b7 buildInjectedPrompt
```

`trace` from `createMpRegistry` confirms `/mp` registry path reaches `renderContextReport`:

```text
extensions/megapowers/mp/mp-handlers.ts 78:323 createMpRegistry
extensions/megapowers/commands.ts 30:cf6 handleMegaCommand
extensions/megapowers/context-summary.ts 140:db3 renderContextReport
extensions/megapowers/context-summary.ts 112:f62 buildContextSummary
extensions/megapowers/prompt-inject.ts 106:0b7 buildInjectedPrompt
```

## Per-Criterion Verification

### Criterion 1: `onBeforeAgentStart` continues to inject the hidden `megapowers-context` message when `buildInjectedPrompt(cwd, store)` returns prompt content.
**Evidence:** `symbol_graph onBeforeAgentStart` shows `buildInjectedPrompt(ctx.cwd, store)` at `hooks.ts:68:a66`, early return only when absent at `69:5c1`, and returned message with `customType: "megapowers-context"` / `display: false` at `78:31b` and `80:874`. Focused test output includes `onBeforeAgentStart — compact context status ...` pass; test assertions at `tests/hooks.test.ts:297-300` verify custom type, hidden display, and prompt content containing `megapowers_signal`.
**Verdict:** pass.

### Criterion 2: When context injection occurs and `ctx.hasUI` is true, `onBeforeAgentStart` updates a compact TUI status indicator using `ctx.ui.setStatus(...)` rather than `ctx.ui.notify(...)`.
**Evidence:** Source anchors `hooks.ts:71-73` call `ctx.ui.setStatus(formatCompactContextStatus(summary))`; `ast_search` found exactly this setStatus call. Test assertions at `tests/hooks.test.ts:300-304` verify one status and `notifications` equals `[]`. Focused suite output shows that test passed.
**Verdict:** pass.

### Criterion 3: The compact TUI status text includes at least workflow, phase, and one additional context signal such as plan mode, task progress, or artifact count.
**Evidence:** `formatCompactContextStatus` source anchors `context-summary.ts:128-131` include `${workflow}/${phase}`, optional `mode`, optional `task`, and `${artifacts.count} artifacts`. Test assertions at `tests/context-summary.test.ts:62-65` verify `feature/plan`, `mode draft`, `task 2/2`, and `artifacts`; focused suite passed.
**Verdict:** pass.

### Criterion 4: The compact TUI status text includes plan mode when the current state is in the `plan` phase with a plan mode.
**Evidence:** Source anchor `context-summary.ts:129:329` pushes `mode ${summary.planMode}` for plan phase. Test assertion `tests/context-summary.test.ts:63:617` verifies `mode draft`; focused suite passed.
**Verdict:** pass.

### Criterion 5: The compact TUI status text includes current task progress when derived tasks exist and the current phase is task-oriented.
**Evidence:** `deriveTaskProgress` reads tasks via `deriveTasks(cwd, issueSlug)` at `context-summary.ts:72:2c9`; `formatCompactContextStatus` includes task progress at `context-summary.ts:130:053`. Tests verify `task 2/2` at `tests/context-summary.test.ts:64:94d` and hook status `task 1/1` at `tests/hooks.test.ts:302:07c`; focused suite passed.
**Verdict:** pass.

### Criterion 6: The compact TUI status text includes artifact availability using an artifact count or equivalent artifact-presence signal.
**Evidence:** `deriveArtifacts` returns `count: available.length` at `context-summary.ts:67:200`; `formatCompactContextStatus` always pushes `${summary.artifacts.count} artifacts` at `context-summary.ts:131:bef`. Tests verify status contains `artifacts` at `tests/context-summary.test.ts:65:303` and `tests/hooks.test.ts:303:405`; focused suite passed.
**Verdict:** pass.

### Criterion 7: `/mega context` renders an on-demand context inspection report.
**Evidence:** `handleMegaCommand` branch at `commands.ts:33-36` calls `renderContextReport` and `ctx.ui.notify(report, "info")` for `context`. Test invokes `handleMegaCommand("context", ...)` at `tests/commands-context.test.ts:42:c5a`, then verifies a notice containing `Workflow: feature`, `Phase: plan`, and `Plan mode: draft` at `47-49`; focused suite passed.
**Verdict:** pass.

### Criterion 8: `/mp context` renders the same context inspection report as `/mega context`.
**Evidence:** `createMpRegistry` adds `registry.context` at `mp-handlers.ts:120-126`, returning `renderContextReport(ctx.cwd, deps.store, ...)`. Test dispatches `dispatchMpCommand("context", ...)` at `tests/mp-command.test.ts:102:263` and verifies report contents at `108-110`; focused suite passed. Both `/mega` and `/mp` structural matches call the same `renderContextReport` function.
**Verdict:** pass.

### Criterion 9: The default context inspection report includes current workflow and phase.
**Evidence:** `renderContextReport` includes `Workflow: ${summary.workflow}` and `Phase: ${summary.phase}` at `context-summary.ts:147-148`. Tests verify those strings in default reports at `tests/context-summary.test.ts:106-107`, `tests/commands-context.test.ts:47-48`, and `tests/mp-command.test.ts:108-109`; focused suite passed.
**Verdict:** pass.

### Criterion 10: The default context inspection report includes plan mode when applicable.
**Evidence:** `renderContextReport` conditionally pushes `Plan mode: ${summary.planMode}` at `context-summary.ts:151-153`. Tests verify `Plan mode: draft` at `tests/context-summary.test.ts:108`, `tests/commands-context.test.ts:49`, and `tests/mp-command.test.ts:110`; focused suite passed.
**Verdict:** pass.

### Criterion 11: The default context inspection report includes current task and TDD state when applicable.
**Evidence:** `renderContextReport` pushes `Current task` and `TDD state` at `context-summary.ts:157-160`. Test verifies `Current task: 1/2` and `TDD state: test-written` at `tests/context-summary.test.ts:109-110`; focused suite passed.
**Verdict:** pass.

### Criterion 12: The default context inspection report includes included artifacts or artifact availability.
**Evidence:** `renderContextReport` emits `Artifact count`, `Available artifacts`, and `Missing artifacts` at `context-summary.ts:167-170`. Test verifies `Available artifacts` and `spec.md` at `tests/context-summary.test.ts:111-112`; focused suite passed.
**Verdict:** pass.

### Criterion 13: The default context inspection report does not include the full rendered prompt text.
**Evidence:** `buildInjectedPrompt` is only called inside `if (options?.debug)` at `context-summary.ts:179-182`; default call at `tests/context-summary.test.ts:104:df6` has no debug options. Tests verify default report does not contain `You are writing a step-by-step implementation plan` at `tests/context-summary.test.ts:117`, default normal report lacks `## Rendered prompt` at `tests/context-summary.test.ts:142`, `/mega context` normal lacks it at `tests/commands-context.test.ts:50`, and `/mp context` normal lacks it at `tests/mp-command.test.ts:111`; focused suite passed.
**Verdict:** pass.

### Criterion 14: `/mega context debug` renders debug details that include the rendered prompt or an explicit rendered-prompt section.
**Evidence:** `/mega context debug` sets `debug: sub === "context debug"` at `commands.ts:34`; `renderContextReport` adds `## Rendered prompt` and `buildInjectedPrompt(...)` output at `context-summary.ts:179-182`. Test invokes `handleMegaCommand("context debug", ...)` at `tests/commands-context.test.ts:43` and verifies `## Rendered prompt` plus prompt text at `51-52`; focused suite passed.
**Verdict:** pass.

### Criterion 15: `/mp context debug` renders the same debug details as `/mega context debug`.
**Evidence:** `/mp` context handler sets `debug: args.trim().toLowerCase() === "debug"` at `mp-handlers.ts:124`. Test invokes `dispatchMpCommand("context debug", ...)` at `tests/mp-command.test.ts:103` and verifies `## Rendered prompt` plus prompt text at `112-113`; focused suite passed. Both debug command paths use `renderContextReport`.
**Verdict:** pass.

### Criterion 16: Context summary and inspection data are derived on demand from disk-backed state, derived tasks, workflow config, and artifact files.
**Evidence:** `buildContextSummary` calls `readState(cwd)` at `context-summary.ts:113`, `deriveTaskProgress` calls `deriveTasks` at `72`, `deriveArtifacts` uses workflow config via `getWorkflowConfig(workflow).phases` at `55` and artifact existence via `planFileExists` at `63`, and `deriveGuidance` uses `getWorkflowConfig` and `deriveToolInstructions` at `96-100`. Trace from `handleMegaCommand` confirms `renderContextReport -> buildContextSummary -> deriveArtifacts/deriveTaskProgress/deriveGuidance`.
**Verdict:** pass.

### Criterion 17: Running context summary, `/mega context`, `/mp context`, `/mega context debug`, or `/mp context debug` does not write derived prompt/context data into `.megapowers/state.json`.
**Evidence:** Tests compare state file before/after. `buildContextSummary` test asserts `afterState` equals `beforeState` at `tests/context-summary.test.ts:46-51`; `/mega context` and `/mega context debug` assert state unchanged at `tests/commands-context.test.ts:40-53`; `/mp context` and `/mp context debug` assert state unchanged at `tests/mp-command.test.ts:97-107`. Focused suite passed.
**Verdict:** pass.

### Criterion 18: The implementation provides a clear context/tool-guidance summary that identifies which phase or mode guidance is active.
**Evidence:** `deriveGuidance` returns `active: ${promptSourceFor(...)} is active for ${workflow}/${phase} (${planMode})` at `context-summary.ts:104-105`; report includes `## Tool guidance` and `summary.toolGuidance.active` at `173-174`. Test verifies `prompts/write-plan.md` at `tests/context-summary.test.ts:59` and in report at `114`; focused suite passed.
**Verdict:** pass.

### Criterion 19: The context/tool-guidance summary references existing phase-specific guidance instead of duplicating large tool descriptions into a new parallel guidance system.
**Evidence:** `deriveGuidance` references prompt files and `docs/phase-tools.md` at `context-summary.ts:106`, and uses existing `deriveToolInstructions(phaseConfig, issueSlug, { isTerminal })` at `100`. Test verifies `docs/phase-tools.md` appears in summary/report at `tests/context-summary.test.ts:60` and `115`; focused suite passed.
**Verdict:** pass.

### Criterion 20: The context/tool-guidance summary handles project-specific tools as “preferred if available” or equivalent wording unless active-tool detection is implemented.
**Evidence:** `deriveGuidance` sets `availabilityNote: "Project-specific tools mentioned by guidance are preferred if available."` at `context-summary.ts:107`. Tests verify `preferred if available` at `tests/context-summary.test.ts:61` and `116`; focused suite passed.
**Verdict:** pass.

### Criterion 21: Existing phase-specific prompt guidance behavior remains intact for current prompt files and `docs/phase-tools.md`.
**Evidence:** New context summary references existing prompt files and `docs/phase-tools.md` without modifying prompt assembly. `buildInjectedPrompt` remains on the hook path at `hooks.ts:68` and debug report uses it only in debug mode at `context-summary.ts:182`. Full suite includes prompt/phase guidance tests and passed: full output includes `tests/prompts-no-save-artifact.test.ts` pass and `deriveToolInstructions` workflow config tests pass.
**Verdict:** pass.

### Criterion 22: The hidden injected prompt does not materially grow with large duplicated tool descriptions as part of this feature.
**Evidence:** `onBeforeAgentStart` still returns `content: prompt` from `buildInjectedPrompt` at `hooks.ts:68-80`; it does not append context summary content to the prompt. `renderContextReport` only includes rendered prompt when `options?.debug` at `context-summary.ts:179-182`, and hidden prompt injection path does not call `renderContextReport`. Trace confirms hook separately calls `buildContextSummary` for status and `buildInjectedPrompt` for hidden message.
**Verdict:** pass.

### Criterion 23: Context visibility behavior is testable through unit tests or mocked hook/command contexts without requiring a live Pi TUI.
**Evidence:** Tests use mocked contexts: hook test constructs `ctx.ui.notify`/`ctx.ui.setStatus` arrays at `tests/hooks.test.ts:284-292`; `/mega` command test uses mocked `ctx.ui.notify` at `tests/commands-context.test.ts:38-39`; `/mp` command test uses `makeCtx()` and registry dispatch at `tests/mp-command.test.ts:98-103`. Focused suite passed all these tests.
**Verdict:** pass.

## Bugfix Reproduction

Not applicable: this is a feature workflow issue, not a bugfix workflow.

## Overall Verdict

pass

All 23 acceptance criteria are backed by fresh test output plus source, symbol, structural search, and static trace evidence. The full suite passed with `804 pass`, `0 fail`, and the focused context suite passed with `21 pass`, `0 fail`.
