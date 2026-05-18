# Megapowers context visibility and inspection commands

## Summary

Issue #128 adds lightweight visibility into the hidden Megapowers prompt context without exposing or persisting full injected prompts by default. Users now get a compact TUI status indicator when hidden context injection occurs, plus on-demand `/mega context` and `/mp context` inspection reports.

This addresses the opacity from hidden `megapowers-context` injection while keeping the existing prompt-injection path intact and avoiding prompt bloat.

## What changed

### Compact status indicator

`onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any>` still calls `buildInjectedPrompt(ctx.cwd, store)` and returns the hidden `megapowers-context` message with `display: false`. When prompt content exists and `ctx.hasUI` is true, it now derives a compact summary and updates the keyed Megapowers status slot with `ctx.ui.setStatus("megapowers", ...)` instead of sending a notification.

The status text is produced by:

```ts
formatCompactContextStatus(summary: MegapowersContextSummary) => string
```

It includes workflow/phase, plan mode when applicable, task progress when derived tasks exist, and artifact count.

### Derived context summary

New API surface:

```ts
buildContextSummary(cwd: string, store?: Store) => MegapowersContextSummary
```

The summary is derived on demand from:

- disk-backed state via `readState(cwd)`
- derived tasks via `deriveTasks(cwd, issueSlug)`
- workflow config via `getWorkflowConfig(workflow)`
- artifact files under `.megapowers/plans/<issue>/`
- existing phase prompt/tool guidance references

It does not write derived prompt/context data to `.megapowers/state.json`.

### `/mega context` and `/mp context`

New report renderer:

```ts
renderContextReport(cwd: string, store?: Store, options?: { debug?: boolean }) => string
```

Default reports include:

- enabled state and active issue
- workflow and phase
- plan mode when applicable
- current task and TDD state when applicable
- artifact count plus available/missing artifacts
- active prompt/tool-guidance source and compact guidance summary

Default reports intentionally do **not** include the full rendered prompt. Debug mode (`/mega context debug` and `/mp context debug`) adds an explicit `## Rendered prompt` section.

`/mega context` routes through `handleMegaCommand(args: string, ctx: any, deps: Deps): Promise<void>` and displays the report with the existing UI notification mechanism because it is an on-demand command result.

`/mp context` is registered through:

```ts
createMpRegistry(deps: Deps) => MpRegistry
```

Both command paths use the same `renderContextReport(...)` implementation to avoid output drift.

## Tool-guidance behavior

The context report identifies which prompt source is active, for example `prompts/write-plan.md`, `prompts/review-plan.md`, or `prompts/implement-task.md`. It references existing prompt markdown and `docs/phase-tools.md` as the source of truth instead of duplicating large tool descriptions into a new parallel system.

Plan mode has compact mode-specific guidance:

- draft/revise: use `megapowers_plan_task`, then `megapowers_signal` with `plan_draft_done`
- review: submit the verdict with `megapowers_plan_review`

Project-specific tools are described as preferred if available, avoiding a full dynamic tool-capability system.

## Correctness notes

- TDD state is only shown when it belongs to the current derived task id. This prevents stale TDD state from task N being reported for task N+1.
- Non-contiguous task ids are handled by comparing `tddTaskState.taskIndex` against `tasks[currentTaskIndex].index`.
- Debug prompt rendering is isolated to the explicit debug report path and does not affect hidden prompt size.

## Verification

Focused verification passed:

```text
bun test tests/context-summary.test.ts tests/hooks.test.ts tests/commands-context.test.ts tests/mp-command.test.ts
24 pass
0 fail
96 expect() calls
```

Full verification passed:

```text
bun test && bun run tsc --noEmit
807 pass
0 fail
1990 expect() calls
```
