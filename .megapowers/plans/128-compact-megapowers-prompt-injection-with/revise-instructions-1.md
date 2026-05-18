# Revision Instructions — Iteration 1

The canonical structured task files in `.megapowers/plans/128-compact-megapowers-prompt-injection-with/tasks/` are not executable TDD tasks. Each task currently contains only a summary plus a pointer to `plan.md`, for example:

```md
Implement Task N exactly as written in `.megapowers/plans/128-compact-megapowers-prompt-injection-with/plan.md` ...
```

That fails the plan quality bar. A developer must be able to execute any task from the task file itself. Update each `megapowers_plan_task` description so it contains the full task body: Files, Step 1 through Step 5, complete copy-pasteable test code, exact RED command/error, complete implementation code, PASS command, full-suite command, and task-specific AC references.

Do not leave “see plan.md”, “as written in plan.md”, summaries, or placeholders in task descriptions.

## Task 1: Derive compact context summary

Replace the summary-only description with the full Task 1 body from `plan.md`. It must include the complete `tests/context-summary.test.ts` code and complete `extensions/megapowers/context-summary.ts` implementation code inline.

The task file currently only says:

```md
Summary: create `extensions/megapowers/context-summary.ts` and `tests/context-summary.test.ts`...
```

It must instead include real executable sections like:

```md
**Step 1 — Write the failing test**
Create `tests/context-summary.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
...
expect(status).toContain("feature/plan");
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/context-summary.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/context-summary.js' from 'tests/context-summary.test.ts'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/context-summary.ts`:

```ts
import { existsSync } from "node:fs";
...
export function formatCompactContextStatus(summary: MegapowersContextSummary): string {
  ...
}
```
```

Also add an explicit AC coverage line in the task description, for example:

```md
**Covers:** AC 3, AC 4, AC 5, AC 6, AC 16, AC 17, AC 18, AC 19, AC 20, AC 22
```

## Task 2: Update hook status indicator

Replace the summary-only description with the full Task 2 body from `plan.md`. It must include the full test appended to `tests/hooks.test.ts` and the full replacement code for `onBeforeAgentStart`.

The task must not merely say:

```md
Implementation: import `buildContextSummary` and `formatCompactContextStatus`...
```

It must include the actual implementation code:

```ts
export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;
  await preparePlanReviewContext(ctx.cwd);
  const prompt = buildInjectedPrompt(ctx.cwd, store);
  if (!prompt) return;

  if (ctx.hasUI && ctx.ui?.setStatus) {
    const summary = buildContextSummary(ctx.cwd, store);
    ctx.ui.setStatus(formatCompactContextStatus(summary));
  }

  return {
    message: {
      customType: "megapowers-context",
      content: prompt,
      display: false,
    },
  };
}
```

Add explicit AC coverage:

```md
**Covers:** AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 23
```

## Task 3: Render default context inspection report

Replace the summary-only description with the full Task 3 body from `plan.md`. It must include the complete test that imports `renderContextReport` and verifies workflow, phase, plan mode, task state, artifacts, tool guidance, and absence of prompt text.

The implementation section must include the complete `formatList` and `renderContextReport(cwd: string, store?: Store): string` code, not a prose summary.

Add explicit AC coverage:

```md
**Covers:** AC 9, AC 10, AC 11, AC 12, AC 13, AC 16, AC 18, AC 19, AC 20, AC 21
```

## Task 4: Render debug context inspection report

Replace the summary-only description with the full Task 4 body from `plan.md`. It must include the complete debug-mode test and the full implementation change.

The implementation must show the actual import and changed signature:

```ts
import { buildInjectedPrompt } from "./prompt-inject.js";

export function renderContextReport(cwd: string, store?: Store, options?: { debug?: boolean }): string {
  ...
  if (options?.debug) {
    lines.push("");
    lines.push("## Rendered prompt");
    lines.push(buildInjectedPrompt(cwd, store) ?? "No rendered prompt available.");
  }
  return lines.join("\n");
}
```

Add explicit AC coverage:

```md
**Covers:** AC 13, AC 14, AC 15, AC 16, AC 22
```

## Task 5: Add `/mega context` command

Replace the summary-only description with the full Task 5 body from `plan.md`. It must include the complete `tests/commands-context.test.ts` source and the exact branch to add in `extensions/megapowers/commands.ts`.

The implementation code must be inline:

```ts
if (sub === "context" || sub === "context debug") {
  const report = renderContextReport(ctx.cwd, deps.store, { debug: sub === "context debug" });
  if (ctx.hasUI) ctx.ui.notify(report, "info");
  return;
}
```

Add explicit AC coverage:

```md
**Covers:** AC 7, AC 9, AC 10, AC 14, AC 17
```

## Task 6: Add `/mp context` command

Replace the summary-only description with the full Task 6 body from `plan.md`. It must include the complete appended test for `tests/mp-command.test.ts`, including temp-state setup, default/debug dispatch assertions, and completion assertion.

The implementation code must be inline:

```ts
import { renderContextReport } from "../context-summary.js";
```

Add `"context"` to `MP_SUBCOMMANDS`, then add:

```ts
registry.context = {
  tier: "programmatic",
  description: "Inspect current derived Megapowers context",
  execute: async (args: string, ctx: ExtensionCommandContext) => {
    return renderContextReport(ctx.cwd, deps.store, { debug: args.trim().toLowerCase() === "debug" });
  },
};
```

Add explicit AC coverage:

```md
**Covers:** AC 8, AC 9, AC 10, AC 15, AC 21
```
