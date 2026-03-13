---
id: 12
title: Remove reviewApproved persistence and UI state write remnants
status: approved
depends_on:
  - 11
no_test: false
files_to_modify:
  - extensions/megapowers/state/state-io.ts
  - extensions/megapowers/ui.ts
  - tests/state-io.test.ts
files_to_create: []
---

### Task 12: Remove reviewApproved persistence and UI state write remnants [depends: 11]

**Files:**
- Modify: `extensions/megapowers/state/state-io.ts`
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/state-io.test.ts`

**Step 1 — Write the failing test**
Update `tests/state-io.test.ts` with these two concrete checks:

```ts
it("KNOWN_KEYS no longer preserves reviewApproved on read", () => {
  const dir = join(tmp, ".megapowers");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "state.json"),
    JSON.stringify({ ...createInitialState(), activeIssue: "001-test", reviewApproved: true }),
  );

  const state = readState(tmp);
  expect((state as any).reviewApproved).toBeUndefined();
});

it("writeState output and ui.ts source no longer mention reviewApproved", () => {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test" } as any);
  const raw = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
  expect(raw).not.toContain("reviewApproved");

  const uiSource = readFileSync(
    join(process.cwd(), "extensions/megapowers/ui.ts"),
    "utf-8",
  );
  expect(uiSource).not.toContain("reviewApproved:");
});
```

Delete or rewrite the old round-trip assertion that expected `reviewApproved: true` to survive read/write.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-io.test.ts`
Expected: FAIL — `expect(received).not.toContain("reviewApproved")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/state/state-io.ts`, remove `"reviewApproved"` from `KNOWN_KEYS`.

In `extensions/megapowers/ui.ts`, delete every explicit `reviewApproved: false,` property from the issue-activation and batch-activation state objects so those writes now rely on `createInitialState()` plus the remaining explicit fields only.

The changed UI snippets should look like this pattern after cleanup:

```ts
const newState: MegapowersState = {
  ...state,
  activeIssue: issue.slug,
  workflow: type,
  phase: firstPhase,
  phaseHistory: [],
  currentTaskIndex: 0,
  completedTasks: [],
  tddTaskState: null,
  doneActions: [],
};
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-io.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
