---
id: 11
title: Remove jj fields from state-machine and state-io
status: approved
depends_on:
  - 10
no_test: false
files_to_modify:
  - extensions/megapowers/state/state-machine.ts
  - extensions/megapowers/state/state-io.ts
  - tests/state-machine.test.ts
  - tests/state-io.test.ts
files_to_create: []
---

### Task 11: Remove jj fields from state-machine and state-io [depends: 10]
**Covers AC 2, AC 3**

**Step 1 — Write failing tests**

In `tests/state-machine.test.ts` (imports `createInitialState` already exist):

```ts
it("createInitialState has no jj fields", () => {
  const state = createInitialState();
  expect("jjChangeId" in state).toBe(false);
  expect("taskJJChanges" in state).toBe(false);
});
```

In `tests/state-io.test.ts` (imports `mkdirSync`, `writeFileSync`, `join`, `readState`, `createInitialState` already exist; `tmp` is the test fixture dir):

```ts
it("AC3: drops legacy jj keys when reading state.json (silently ignored on read)", () => {
  const dir = join(tmp, ".megapowers");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    ...createInitialState(),
    jjChangeId: "x",
    taskJJChanges: { 1: "y" },
  }));
  const state = readState(tmp);
  expect("jjChangeId" in state).toBe(false);
  expect("taskJJChanges" in state).toBe(false);
});

it("AC3: write then read round-trip has no jj fields", () => {
  writeState(tmp, createInitialState());
  const raw = JSON.parse(readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8"));
  expect("jjChangeId" in raw).toBe(false);
  expect("taskJJChanges" in raw).toBe(false);
});
```

**Step 2 — Run tests, verify RED**

Run:
- `bun test tests/state-machine.test.ts tests/state-io.test.ts`

Expected failure message from `tests/state-machine.test.ts`:
```
expect(received).toBe(expected)
Expected: false
Received: true
```
because `createInitialState()` still includes `jjChangeId: null` and `taskJJChanges: {}`.

**Step 3 — Implement (full code)**

In `extensions/megapowers/state/state-machine.ts`:

1. Remove from `MegapowersState` interface:
   ```ts
   // DELETE these two lines:
   taskJJChanges: Record<number, string>;
   jjChangeId: string | null;
   ```

2. Remove from `PhaseTransition` interface:
   ```ts
   // DELETE:
   jjChangeId?: string;
   ```

3. Remove from `createInitialState()` return:
   ```ts
   // DELETE these two lines:
   taskJJChanges: {},
   jjChangeId: null,
   ```

4. Remove `taskJJChanges` reset in `transition()` (two occurrences):
   ```ts
   // DELETE:
   if (to === "implement" && tasks) {
     ...
     next.taskJJChanges = {};  // Remove this line
   } else if (to === "implement") {
     next.taskJJChanges = {};  // Remove this line
   }
   ```
In `extensions/megapowers/state/state-io.ts`:
- Remove `"taskJJChanges"` and `"jjChangeId"` from `KNOWN_KEYS` set. This ensures:
  - Read: legacy keys in JSON are silently ignored (not picked into state)
  - Write: since the fields don't exist in the state object, they're not written

Update test fixtures in `tests/state-machine.test.ts` and `tests/state-io.test.ts` to stop constructing `taskJJChanges` and `jjChangeId` fields.

**Step 4 — Run targeted tests, verify GREEN**

Run:
- `bun test tests/state-machine.test.ts tests/state-io.test.ts`

Expected: PASS.

**Step 5 — Full regression**

Run:
- `bun test`
Expected: PASS.
