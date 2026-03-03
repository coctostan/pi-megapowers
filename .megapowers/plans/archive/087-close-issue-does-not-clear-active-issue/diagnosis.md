# Diagnosis

## Root Cause

Two independent bugs in `extensions/megapowers/hooks.ts`:

### Bug 1 (Primary): `close-issue` action has no handler and `writeState` always spreads existing state

`onAgentEnd` processes `doneActions` in a queue. The current `main` branch has **no `close-issue` handler**. The action falls through to the content-capture block (line 131), which:
- Only fires when `text.length > 100` (so with a short or empty LLM response, `close-issue` is never even removed from the queue)
- Even when it fires, calls `writeState(ctx.cwd, { ...state, doneActions: [] })` — **spreads `...state`, preserving `activeIssue` and `phase` verbatim**

The `writeState` spread pattern is correct for partial updates (e.g. updating `doneActions` while preserving other fields). It is **incorrect for issue closure**, which requires resetting `activeIssue` and `phase` to `null`.

The 086 branch added a `close-issue` handler but made the same mistake:
```typescript
// 086 branch — added a handler, same bug:
writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
//                    ^^^^^^^^^ spreads activeIssue + phase — never cleared
```

The `createInitialState()` function in `state-io.ts` returns exactly the correct idle state (`activeIssue: null, phase: null`), but it is **never invoked** in the close-issue handler path.

### Bug 2 (Secondary): Non-content-capture actions are only consumed when `text.length > 100`

The entire `doneActions` queue-processing block (lines 126–143) is nested inside:
1. An outer check `if (lastAssistant)` — no assistant message → nothing consumed
2. An inner check `if (text && text.length > 100)` — short text → nothing consumed

Actions like `capture-learnings`, `squash-task-changes`, and `close-issue` are **immediate actions** that don't need LLM-generated text. When they appear early in the queue before content-capture actions, short LLM responses leave them permanently stuck, blocking the entire queue. This prevents `close-issue` from ever being reached.

---

## Trace

### Data flow leading to the bug:

```
1. phase_next → "done"
   state-machine.ts transition():
   → state.phase = "done", state.doneActions = []   (reset on transition)

2. showDoneChecklist (ui.ts:89–103)
   → user selects ["close-issue"]
   → writeState(cwd, { ...readState(cwd), doneActions: ["close-issue"] })
   → state.json: { activeIssue: "086-...", phase: "done", doneActions: ["close-issue"] }

3. LLM session runs with done-phase prompt
   → prompt-inject.ts:156 builds done.md template with doneActions list
   → LLM produces response (may be short or empty)

4. onAgentEnd fires (hooks.ts:117)
   → state = readState() = { activeIssue: "086-...", phase: "done", doneActions: ["close-issue"] }
   → phase === "done" && doneActions.length > 0 → ENTERS BLOCK
   → doneAction = "close-issue"
   → NO matching handler (no "if (doneAction === 'close-issue')" in current hooks.ts)
   → Falls through to content-capture block
   → if (lastAssistant) → if (text && text.length > 100)
     CASE A (text > 100): writeState({ ...state, doneActions: [] })
                          → activeIssue still "086-...", phase still "done"  ← BUG
     CASE B (no msg / short text): nothing happens at all

5. Next session start: readState() returns
   { activeIssue: "086-...", phase: "done", doneActions: [] }
   → onSessionStart sees activeIssue and phase set
   → renders done dashboard for the completed issue AGAIN  ← SYMPTOM
```

### Where the chain breaks:
**Step 4** — the `close-issue` action has no handler, and the generic fallback `writeState` call never touches `activeIssue` or `phase`.

---

## Affected Code

| File | Lines | Issue |
|------|-------|-------|
| `extensions/megapowers/hooks.ts` | 126–143 | No `close-issue` handler; content-capture fallback spreads `...state` |
| `extensions/megapowers/hooks.ts` | 128–131 | `text.length > 100` gate blocks all non-content-capture actions |

The 086 branch also has the bug at its added handler (between lines 128–134 in that branch's diff), but that code is not yet in main.

---

## Pattern Analysis

**Working code — issue activation** (`ui.ts:274–302`):
```typescript
// Explicitly sets ALL issue-related fields; nothing from old state leaks through
const newState: MegapowersState = {
  ...state,
  activeIssue: issue.slug,   // ← explicitly set
  workflow: issue.type,       // ← explicitly set
  phase: firstPhase,          // ← explicitly set
  phaseHistory: [],
  reviewApproved: false,
  jjChangeId: null,
  currentTaskIndex: 0,
  completedTasks: [],
  tddTaskState: null,
  taskJJChanges: {},
  doneActions: [],
};
writeState(ctx.cwd, newState);
```

**Broken code — issue closure** (`hooks.ts:140`):
```typescript
// Spreads ...state — activeIssue, phase, workflow all leak through unchanged
writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
```

**Key difference:**
1. Activation explicitly sets all issue fields to new values — no leak from prior state
2. Closure only modifies `doneActions` via spread — `activeIssue`, `phase`, `workflow`, `jjChangeId` all remain set
3. `createInitialState()` already exists and returns the exact idle state needed, but is never called in this path

**Correct pattern for closure:**
```typescript
// Use createInitialState() as the base, preserve only session-scoped fields
writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });
```

---

## Risk Assessment

**Change scope:** Narrowly contained to `onAgentEnd` in `hooks.ts`. No callers — it's a hook invoked by the pi harness.

**Dependencies that will benefit:**
- `onSessionStart` (hooks.ts:32): reads `activeIssue` on every session start — clearing it immediately fixes the stuck-session symptom
- `buildInjectedPrompt` (prompt-inject.ts): checks `activeIssue`/`phase` before injecting context — returns early for idle state
- `canWrite()` (write-policy.ts:69): uses `phase === null` to allow all writes — idle state is safe (no restrictions)
- `renderDashboard` (ui.ts): shows "No active issue" when `activeIssue` is null — immediately correct

**Fields to clear:**
- `activeIssue → null` (primary symptom)
- `phase → null` (primary symptom)
- `workflow → null` (consistency — no workflow without an issue)
- `jjChangeId → null` (cleanup — stale change ID)
- `doneActions → []` (already done in existing code)
- Other task state (`currentTaskIndex`, `completedTasks`, `tddTaskState`, `taskJJChanges`) → reset

Using `createInitialState()` as the base resets all of these correctly in one call.

**No regression risk** from clearing these fields — `createInitialState()` is the same state that a fresh install produces, and `onSessionStart` handles the idle state correctly.

---

## Fixed When

1. After `close-issue` fires in `onAgentEnd`, `state.activeIssue` is `null` in `state.json`
2. After `close-issue` fires, `state.phase` is `null` in `state.json`
3. After `close-issue` fires, `state.doneActions` is `[]` in `state.json`
4. `store.updateIssueStatus(activeIssue, "done")` is called when `close-issue` fires
5. A new session after issue completion shows no active issue (idle state / issue picker)
6. Unrecognized done actions (`capture-learnings`, `squash-task-changes`, etc.) are always consumed from the queue regardless of LLM text length — they do not block `close-issue`
7. All 6 tests in `tests/hooks-close-issue.test.ts` pass
