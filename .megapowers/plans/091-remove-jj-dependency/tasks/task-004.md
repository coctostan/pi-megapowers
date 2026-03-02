---
id: 4
title: Remove jj from UI issue/triage flows and command deps
status: approved
depends_on:
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
  - extensions/megapowers/commands.ts
  - tests/ui.test.ts
  - tests/commands-phase.test.ts
files_to_create: []
---

### Task 4: Remove jj from UI issue/triage flows and command deps [depends: 3]
**Covers AC 5, AC 6**

> Note: This task is intentionally limited to *UI rendering + command dependency wiring* only. `handleSignal` jj-parameter removal is handled in Task 6 to avoid overlap.

#### Step 1 — Write failing tests

In `tests/ui.test.ts` add:

```ts
it("renderDashboardLines does not show jj line", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature" as const,
    phase: "implement" as const,
  };
  const lines = renderDashboardLines(state, [], plainTheme as any, []);
  expect(lines.join("\n")).not.toContain("jj:");
});

it("getDoneChecklistItems never includes squash-task-changes", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature" as const,
    phase: "done" as const,
  };
  expect(getDoneChecklistItems(state).map((i) => i.key)).not.toContain("squash-task-changes");
});
```

In `tests/commands-phase.test.ts` add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("commands.ts no longer references createJJ or deps.jj", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/commands.ts"), "utf-8");
  expect(source).not.toContain("createJJ");
  expect(source).not.toContain("deps.jj");
});
```

Also, in `tests/ui.test.ts`, remove any `createMockJJ()` usage in calls to issue/triage handlers (delete the jj arg entirely).

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/ui.test.ts tests/commands-phase.test.ts`

Expected failures:
- UI test fails because the dashboard still prints `jj:`.
- commands test fails because `commands.ts` still imports `createJJ` and/or references `deps.jj`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/ui.ts`:
1. Remove jj-related imports (`JJ`, `formatChangeDescription`).
2. Remove any `jj:` dashboard line rendering.
3. Remove `squash-task-changes` from done checklist items.
4. Update `handleIssueCommand` and `handleTriageCommand` signatures/implementation to **not** accept `jj`.
5. Remove any `if (await jj.isJJRepo()) { ... }` blocks inside those handlers.

In `extensions/megapowers/commands.ts`:
1. Remove `import { createJJ, type JJ } from "./jj.js";`.
2. Remove jj from deps types:

```ts
export type RuntimeDeps = { store?: Store; ui?: MegapowersUI };
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI };
```

3. Update `ensureDeps` to no longer create jj.
4. Update issue/triage command wiring to call UI without jj:
   - `deps.ui.handleIssueCommand(ctx, state, deps.store, args)`
   - `deps.ui.handleTriageCommand(ctx, state, deps.store, args)`

(Do not change `handleSignal` call signatures here; Task 6 removes jj threading.)

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/ui.test.ts tests/commands-phase.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
