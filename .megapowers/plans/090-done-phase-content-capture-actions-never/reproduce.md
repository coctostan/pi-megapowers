# Reproduction: done-phase content-capture doneActions permanently blocked by `text.length > 100` guard

## Steps to Reproduce

### Scenario A — `capture-learnings` deadlock

1. Enter the `done` phase with `doneActions: ["capture-learnings", "close-issue"]` and `doneChecklistShown: true`.
2. The LLM receives the done-phase prompt which for `capture-learnings` says:
   > "Write 3–7 bullet-point learnings to `.megapowers/plans/.../learnings.md`" via `write(...)`.
3. The LLM calls `write()` to create the learnings file, then produces a short acknowledgment response like:
   > `"I've written the learnings to the file."` (39 chars)
4. `onAgentEnd` fires. It reads `doneActions[0] === "capture-learnings"`, reaches the content-capture block (lines 192–207 of `hooks.ts`), and evaluates `text.length > 100` → **false** (39 < 100).
5. `writeState` is never called → `capture-learnings` stays in `doneActions[0]`.
6. Every subsequent agent turn repeats steps 3–5 forever. `close-issue` is never reached.

### Scenario B — `write-changelog` deadlock

1. Enter the `done` phase with `doneActions: ["write-changelog"]`.
2. The LLM receives the done-phase prompt which for `write-changelog` says:
   > "Return only the entry block; the system appends it automatically."
3. The LLM returns a minimal valid changelog entry:
   ```
   ## [Unreleased]
   ### Fixed
   - Fix done-phase deadlock (#090)
   ```
   (58 chars)
4. `onAgentEnd` fires. `text.length > 100` → **false** (58 < 100).
5. `store.appendChangelog()` is never called. `writeState` never removes the action.
6. `write-changelog` stays at `doneActions[0]` forever.

## Expected Behavior

- `capture-learnings`: action is consumed after the LLM writes the learnings file (regardless of response length).
- `write-changelog`: action is consumed and the changelog entry is appended when the LLM returns the entry block (even if < 100 chars).
- Both actions should unblock `close-issue`, allowing state to reset.

## Actual Behavior

Both `capture-learnings` and `write-changelog` are **never consumed** from `doneActions` when the LLM response is shorter than 100 characters. Since `doneActions` is processed as a front-of-queue structure, any stuck action permanently blocks all subsequent actions, including `close-issue`. The issue never closes, `state.json` never resets, and `activeIssue` remains non-null forever.

## Evidence

### Code — the exact guard (hooks.ts lines 192–206)

```typescript
// Content-capture actions — need LLM-generated text > 100 chars
const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
if (lastAssistant) {
  const text = getAssistantText(lastAssistant);
  if (text && text.length > 100) {          // ← THE BUG: blocks consumption
    if (doneAction === "generate-docs" || doneAction === "generate-bugfix-summary") {
      store.writeFeatureDoc(state.activeIssue, text);
    }
    if (doneAction === "write-changelog") {
      store.appendChangelog(text);
    }
    writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
    // ↑ Only reached when text.length > 100. If short response → never reached.
  }
  // ← No else branch: action stays in doneActions permanently
}
```

### Measured response lengths vs. threshold

| Action            | Prompt instruction               | Typical response          | Length | Passes > 100? |
|-------------------|----------------------------------|---------------------------|--------|---------------|
| `capture-learnings` | Write file via `write()`       | "I've written the learnings to the file." | 39     | ❌ NO         |
| `write-changelog`   | "Return only the entry block"  | `## [Unreleased]\n### Fixed\n- Fix (#090)` | 58     | ❌ NO         |
| `generate-docs`     | "Present the full document"    | Full markdown doc          | >100   | ✅ YES (usually) |
| `generate-bugfix-summary` | "Present the full summary" | Full markdown doc        | >100   | ✅ YES (usually) |

### Protocol mismatch in done.md prompt

The `capture-learnings` action **explicitly tells the LLM to use `write()`**:
```
write({ path: ".megapowers/plans/{{issue_slug}}/learnings.md", content: "<markdown bullet list>" })
```
But the hook's consumption path requires `text.length > 100` — which requires a long *text response*, not a file write. These two requirements are irreconcilable.

The `write-changelog` action says "Return only the entry block" — but a minimal entry is 58 chars, under the 100-char guard.

### Failing tests (all 3 fail)

Test file: `tests/bug090-doneactions-deadlock.test.ts`

```
bun test tests/bug090-doneactions-deadlock.test.ts

tests/bug090-doneactions-deadlock.test.ts:
  ✗ BUG: capture-learnings stays stuck forever when LLM writes file directly and produces short response
    expect(["capture-learnings"]).toEqual([])
    
  ✗ BUG: write-changelog stays stuck when LLM produces short changelog entry (< 100 chars)
    expect(["write-changelog"]).toEqual([])
    
  ✗ BUG: end-to-end — capture-learnings blocks close-issue permanently in real scenario
    expect("090-done-phase-bug").toBeNull()

 0 pass
 3 fail
```

### Existing test that asserts buggy behavior as "correct"

`tests/hooks.test.ts` line 120 contains:
```typescript
it("does nothing when text is shorter than 100 chars", async () => {
  setState(tmp, { phase: "done", doneActions: ["capture-learnings"] });
  await onAgentEnd(makeAgentEndEvent("short response"), makeCtx(tmp), makeDeps(tmp) as any);
  // Short text means the capture block is not entered — list unchanged
  expect(readState(tmp).doneActions).toEqual(["capture-learnings"]); // ← confirms bug
});
```
This test passes, documenting the stuck behavior as the expected outcome.

## Environment

- Language: TypeScript (Bun runtime)
- Test runner: `bun test`
- File: `extensions/megapowers/hooks.ts` lines 192–207
- Prompt: `prompts/done.md`
- Git: `e8e4cff` (latest commit on main)

## Failing Test

**File:** `tests/bug090-doneactions-deadlock.test.ts` (newly created)

Three tests, all failing:

1. `capture-learnings` with short response (39 chars < 100) → action never removed
2. `write-changelog` with minimal changelog entry (58 chars < 100) → action never removed, changelog not appended
3. End-to-end: `["capture-learnings", "close-issue"]` — after 5 turns with short responses, `activeIssue` remains non-null (deadlock confirmed)

## Reproducibility

**Always** — deterministic. Any `done` phase with `capture-learnings` or `write-changelog` in `doneActions` that produces an LLM response under 100 chars will deadlock. Given the prompt instructions (`capture-learnings` uses `write()` and `write-changelog` returns a short entry block), this is virtually guaranteed every run.
