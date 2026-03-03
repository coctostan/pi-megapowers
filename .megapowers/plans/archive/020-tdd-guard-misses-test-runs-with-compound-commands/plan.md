## Plan: TDD Guard — Replace Bash Sniffing with Explicit Signals

### Task 1: Add tests_failed signal handler to tool-signal.ts

**Files:**
- Modify: `extensions/megapowers/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Test:** Add tests to `tests/tool-signal.test.ts`:

1. `handleSignal(cwd, "tests_failed")` when phase=implement and tddTaskState={taskIndex:1, state:"test-written", skipped:false} → returns success message, writes tddTaskState.state="impl-allowed" to state.json
2. `handleSignal(cwd, "tests_failed")` when phase=brainstorm → returns error "tests_failed can only be called during the implement phase"
3. `handleSignal(cwd, "tests_failed")` when phase=implement and tddTaskState=null → returns error about no test written yet
4. `handleSignal(cwd, "tests_failed")` when phase=implement and tddTaskState.state="impl-allowed" → returns error about already in impl-allowed state
5. `handleSignal(cwd, "tests_failed")` when phase=implement and tddTaskState.state="red-pending" → returns error (not in test-written state)

**Implementation:** Add a `case "tests_failed"` to the switch in `handleSignal()` that calls a new `handleTestsFailed(cwd)` function. The function:
- Reads state, checks phase is `implement` or `code-review`
- Checks `tddTaskState?.state === "test-written"`
- Writes `tddTaskState.state = "impl-allowed"` to state
- Returns `{ message: "Tests failed (RED ✓). Production code writes are now allowed." }`

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 2: Add tests_passed signal handler to tool-signal.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Test:** Add tests to `tests/tool-signal.test.ts`:

1. `handleSignal(cwd, "tests_passed")` when phase=implement → returns success message, does NOT change tddTaskState
2. `handleSignal(cwd, "tests_passed")` when phase=brainstorm → returns error "tests_passed can only be called during the implement phase"

**Implementation:** Add a `case "tests_passed"` to the switch in `handleSignal()` that calls a new `handleTestsPassed(cwd)` function. The function:
- Reads state, checks phase is `implement` or `code-review`
- Returns `{ message: "Tests passed (GREEN ✓)." }` — no state mutation

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 3: Update megapowers_signal tool schema in index.ts [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/tool-signal.test.ts` (existing tests from Tasks 1-2 already exercise handleSignal; schema is a registration concern — verify via existing integration)

**Test:** The handleSignal tests from Tasks 1-2 already verify the handler logic. For the schema, add a test that confirms `handleSignal` does NOT return "Unknown signal action" for `tests_failed` and `tests_passed` (already covered by Task 1-2 tests).

**Implementation:** In `extensions/megapowers/index.ts`, update the tool registration's `parameters` from:
```typescript
action: Type.Union([
  Type.Literal("task_done"),
  Type.Literal("review_approve"),
  Type.Literal("phase_next"),
]),
```
to:
```typescript
action: Type.Union([
  Type.Literal("task_done"),
  Type.Literal("review_approve"),
  Type.Literal("phase_next"),
  Type.Literal("tests_failed"),
  Type.Literal("tests_passed"),
]),
```

Also update the tool description to include the new actions.

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 4: Delete processBashResult from tool-overrides.ts and its caller in index.ts [depends: 1, 2, 3]

**Files:**
- Modify: `extensions/megapowers/tool-overrides.ts`
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/tool-overrides.test.ts`

**Test:** In `tests/tool-overrides.test.ts`:
- Remove the entire `describe("processBashResult", ...)` block (lines ~164-283)
- Remove `processBashResult` from the import statement
- Add a test: verify `processBashResult` is no longer exported from `tool-overrides.ts` (import check — `expect(typeof (await import("../extensions/megapowers/tool-overrides.js")).processBashResult).toBe("undefined")`)

**Implementation:**
1. In `extensions/megapowers/tool-overrides.ts`: delete the entire `processBashResult` function and its JSDoc comment block
2. In `extensions/megapowers/index.ts`: remove `processBashResult` from the import on line 14, and remove the bash tool_result handler block (lines ~207-210):
   ```typescript
   if (toolName === "bash") {
     const command = (event.input as any)?.command;
     if (command) processBashResult(ctx.cwd, command, event.isError);
   }
   ```

**Verify:** `bun test tests/tool-overrides.test.ts`

---

### Task 5: Delete isTestRunnerCommand and TEST_RUNNER_PATTERNS from write-policy.ts [depends: 4]

**Files:**
- Modify: `extensions/megapowers/write-policy.ts`
- Modify: `extensions/megapowers/tool-overrides.ts` (remove re-export)
- Modify: `extensions/megapowers/index.ts` (remove import)
- Test: `tests/tool-overrides.test.ts`

**Test:** In `tests/tool-overrides.test.ts`:
- Remove `isTestRunnerCommand` from the import if still present
- Verify that importing `isTestRunnerCommand` from write-policy would fail (or simply confirm the existing tests still pass without it)

**Implementation:**
1. In `extensions/megapowers/write-policy.ts`: delete the `TEST_RUNNER_PATTERNS` array and the `isTestRunnerCommand` function, plus the comment block above them ("--- Test runner detection ---")
2. In `extensions/megapowers/tool-overrides.ts`: remove `isTestRunnerCommand` from the import line and from the re-export line
3. In `extensions/megapowers/index.ts`: remove `isTestRunnerCommand` from the import on line 15

**Verify:** `bun test`

---

### Task 6: Remove satellite bash sniffing from index.ts [depends: 5]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: manual verification (satellite sniffing has no dedicated test file — the in-memory logic is inline in index.ts)

**Test:** Confirm existing tests pass. The satellite bash sniffing block (lines ~99-108 in index.ts) is inline code with no unit tests — verification is that `bun test` passes and the `isTestRunnerCommand` import is fully removed.

**Implementation:** In `extensions/megapowers/index.ts`, delete the satellite bash sniffing block inside the `tool_result` handler:
```typescript
// After bash, track test runner results for TDD RED detection (in-memory)
if (toolName === "bash") {
  const command = (event.input as any)?.command;
  if (command && satelliteTddState?.state === "test-written") {
    const state = readState(ctx.cwd);
    if (state.megaEnabled && (state.phase === "implement" || state.phase === "code-review")) {
      if (isTestRunnerCommand(command) && event.isError) {
        satelliteTddState = { ...satelliteTddState, state: "impl-allowed" };
      }
    }
  }
}
```

Note: Satellite sessions will now use `megapowers_signal` tool for `tests_failed`/`tests_passed`. However, the satellite block currently says "megapowers_signal and megapowers_save_artifact are NOT registered for satellites." This needs to be updated — register `megapowers_signal` for satellite sessions too, using the in-memory `satelliteTddState` instead of disk state. Add a satellite-specific `megapowers_signal` tool registration that handles `tests_failed` by setting `satelliteTddState.state = "impl-allowed"` and `tests_passed` as a no-op.

**Verify:** `bun test`

---

### Task 7: Update implement-task prompt with signal instructions [depends: 1, 2]

**Files:**
- Modify: `prompts/implement-task.md`

**Test:** No unit test needed — this is a prompt template change. Verification is reading the file.

**Implementation:** Add a section after "### RED — Write one failing test" step 3, and update the TDD instructions to include signal calls:

In the RED section, after step 3 ("Confirm it fails **for the right reason**"), add:
```
4. Call `megapowers_signal({ action: "tests_failed" })` to unlock production code writes
```

In the GREEN section, after step 2 ("Run the test — confirm it passes"), add:
```
3. Call `megapowers_signal({ action: "tests_passed" })` to acknowledge green tests
```

Renumber existing steps accordingly.

**Verify:** Read `prompts/implement-task.md` and confirm the instructions are present.

---

### Task 8: Full regression test run [depends: 1, 2, 3, 4, 5, 6, 7]

**Files:**
- Test: all test files

**Test:** Run `bun test` and confirm all tests pass. Fix any broken imports or references to deleted functions.

**Implementation:** No new code — this is a verification-only task. [no-test]

**Verify:** `bun test`
