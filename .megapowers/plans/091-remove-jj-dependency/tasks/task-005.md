---
id: 5
title: Remove session-start jj checks and notifications
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
  - tests/hooks.test.ts
  - tests/index-integration.test.ts
  - tests/reproduce-086-bugs.test.ts
files_to_create: []
---

### Task 5: Remove session-start jj checks and notifications [depends: 4]
**Covers AC 4**

#### Step 1 — Write failing tests

In `tests/hooks.test.ts`, add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("hooks.ts no longer imports jj availability helpers/messages", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/hooks.ts"), "utf-8");
  expect(source).not.toContain("checkJJAvailability");
  expect(source).not.toContain("JJ_INSTALL_MESSAGE");
  expect(source).not.toContain("JJ_INIT_MESSAGE");
});
```

In `tests/index-integration.test.ts`, replace any jj-availability/session-start assertions with this explicit test:

```ts
it("onSessionStart does not require jj and still renders dashboard", async () => {
  // Arrange deps with store+ui only
  const ui = createUI();
  const store = createStore(tmp);

  // Ensure state exists and megaEnabled is false so we verify reset-to-true behavior
  writeState(tmp, { ...createInitialState(), megaEnabled: false, activeIssue: null });

  // Call session start
  await onSessionStart({} as any, { cwd: tmp, hasUI: true } as any, { store, ui } as any);

  const state = readState(tmp);
  expect(state.megaEnabled).toBe(true);
});
```

In `tests/reproduce-086-bugs.test.ts`, remove `jj: null` from any deps helper (e.g. `makeDeps`) and from call sites.

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/hooks.test.ts tests/index-integration.test.ts tests/reproduce-086-bugs.test.ts`

Expected failure: `tests/hooks.test.ts` fails because `hooks.ts` still imports `checkJJAvailability` / jj messages.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/hooks.ts`:
1. Remove imports:
   - `checkJJAvailability` from `./jj.js`
   - `JJ_INSTALL_MESSAGE`, `JJ_INIT_MESSAGE` from `./jj-messages.js`
2. In `onSessionStart`, remove any logic that checks jj availability or detects jj change ID mismatches.
3. Keep the existing behavior of reading state from disk, resetting `megaEnabled` to true on session start, and rendering the dashboard when `ctx.hasUI`.

Update tests/fixtures:
- Remove `jj` from deps objects in the tests modified above.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/hooks.test.ts tests/index-integration.test.ts tests/reproduce-086-bugs.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
