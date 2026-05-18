# Revision Instructions — Iteration 2

Only two targeted revisions are needed. The task files are now self-contained, but AC 17 is still under-tested: it explicitly requires context summary, `/mp context`, and `/mp context debug` not to write derived prompt/context data into `.megapowers/state.json`.

## Task 1: Derive compact context summary

Task 1 claims AC 17, but the test only checks that `JSON.stringify(summary)` omits rendered prompt text. It does not prove that running the context summary leaves `.megapowers/state.json` unchanged.

Update Step 1's test import to include `readFileSync`:

```ts
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
```

Then update the test body to snapshot state before and after calling the summary/status helpers:

```ts
const beforeState = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
const summary = buildContextSummary(tmp, store);
const status = formatCompactContextStatus(summary);
const afterState = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");

expect(afterState).toBe(beforeState);
```

Keep the existing assertions. This directly tests the “Running context summary ... does not write derived prompt/context data into `.megapowers/state.json`” part of AC 17.

## Task 6: Add `/mp context` command

Task 6 covers `/mp context` and `/mp context debug`, but it does not assert that running those commands leaves `.megapowers/state.json` unchanged. AC 17 explicitly names `/mp context` and `/mp context debug`, so add the state-file immutability assertion here too.

Update Step 1's import block to include `readFileSync`:

```ts
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
```

Then update the test body after `writeState(...)` and before dispatching commands:

```ts
const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
```

After both dispatch calls, add:

```ts
const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
expect(after).toBe(before);
```

The relevant section should look like:

```ts
writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
const deps = { ...makeDeps(), store: createStore(tmp) } as any;
const ctx = { ...makeCtx(), cwd: tmp } as any;
const registry = createMpRegistry(deps);

const normal = await dispatchMpCommand("context", ctx, registry);
const debug = await dispatchMpCommand("context debug", ctx, registry);
const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
const completions = mpArgumentCompletions("con") ?? [];

expect(after).toBe(before);
```

Keep all existing report-content and completion assertions.
