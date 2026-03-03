# Verification Report: Issue #084

## Test Suite Results

```
bun test
759 pass
0 fail
1676 expect() calls
Ran 759 tests across 72 files. [480ms]
```

Full suite run fresh during this session. Zero failures.

---

## Per-Criterion Verification

### Bug #081 — close-issue not executed in headless done phase

---

### Criterion #081-1: In headless mode (`ctx.hasUI === false`), `showDoneChecklist` writes `doneActions` with all default-checked items instead of returning early

**Evidence — code inspection (`extensions/megapowers/ui.ts:81–88`):**
```typescript
if (!ctx.hasUI) {
  // Headless: auto-select all default-checked items (#081 fix)
  const doneActions = getDoneChecklistItems(state)
    .filter(i => i.defaultChecked)
    .map(i => i.key);
  writeState(cwd, { ...readState(cwd), doneActions });
  return;
}
```
The old early-return (`if (!ctx.hasUI) return;`) is gone. Now it computes defaults and writes them.

**Evidence — tests:**
- `tests/ui.test.ts:354–375` ("auto-populates doneActions with defaults when ctx.hasUI is false (#081)"):
  Calls `showDoneChecklist({ hasUI: false }, tmp)` → asserts `doneActions` contains `generate-docs`, `write-changelog`, `capture-learnings`, `push-and-pr`, `close-issue` (5 items).
- `tests/ui.test.ts:377–395` (bugfix variant): `generate-bugfix-summary` present, `generate-docs` absent.
- `tests/reproduce-084-batch.test.ts:86–97` ("FIX: showDoneChecklist auto-populates defaults when ctx.hasUI is false"): all 5 defaults present.
- `bun test tests/ui.test.ts` → 56 pass, 0 fail.

**Verdict: PASS**

---

### Criterion #081-2: `onAgentEnd` processes `close-issue` → `updateIssueStatus("done")` is called → state is reset to idle

**Evidence — code inspection (`extensions/megapowers/hooks.ts:113–127`):**
```typescript
if (doneAction === "close-issue") {
  const sources = store.getSourceIssues(state.activeIssue);
  for (const source of sources) {
    store.updateIssueStatus(source.slug, "done");
  }
  store.updateIssueStatus(state.activeIssue, "done");
  // Reset state fully to idle — only preserve megaEnabled
  writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });
  ...
  return;
}
```

**Evidence — tests:**
- `tests/hooks.test.ts:521–555` ("end-to-end headless: deferred defaults eventually reach close-issue and reset state (#081 regression)"):
  - Starts with `phase: "done", doneActions: [], doneChecklistShown: false`, `hasUI: false`
  - 6 sequential `onAgentEnd` calls simulate the full pipeline (populate defaults → consume capture actions → skip push-and-pr → close-issue)
  - Asserts: `statusUpdates = [{ slug: "001-test", status: "done" }]`, `finalState.activeIssue === null`, `finalState.phase === null`
- `tests/reproduce-084-batch.test.ts:133–161` ("CONTROL: onAgentEnd DOES close issue when doneActions contains close-issue"):
  - With `doneActions: ["close-issue"]`, confirms `updateIssueStatus` called and `state.activeIssue` becomes null.
- `bun test tests/hooks.test.ts` → 17 pass, 0 fail.

**Verdict: PASS**

---

### Criterion #081-3: `buildInjectedPrompt` injects `done.md` template in the subsequent session

**Evidence — code inspection (`extensions/megapowers/prompt-inject.ts:165–173`):**
```typescript
} else if (state.doneActions.length > 0) {
  // AC16: done.md template reads doneActions, interpolates the list
  vars.done_actions_list = state.doneActions.map((a) => `- ${a}`).join("\n");
  const template = getPhasePromptTemplate("done");
  if (template) {
    const phasePrompt = interpolatePrompt(template, vars);
    if (phasePrompt) parts.push(phasePrompt);
  }
}
```
Template is injected when `doneActions.length > 0`; skipped when empty.

**Evidence — tests:**
- `tests/prompt-inject.test.ts:178–190`: `doneActions: ["generate-docs", "write-changelog", "capture-learnings", "close-issue"]` → result contains all four.
- `tests/prompt-inject.test.ts:203–213`: `doneActions: []` → result does NOT contain "Execute the following wrap-up actions".
- `tests/reproduce-084-batch.test.ts:121–131`: After headless auto-fill (all 5 defaults), `buildInjectedPrompt` contains "wrap-up actions" and "close-issue".
- `bun test tests/prompt-inject.test.ts` → 31 pass, 0 fail.

**Verdict: PASS**

---

### Criterion #081-4: Test: `onAgentEnd` with `hasUI=false` → `updateIssueStatus` is called + `activeIssue` becomes null

**Evidence — test at `tests/hooks.test.ts:521–555`:**
```
"end-to-end headless: deferred defaults eventually reach close-issue and reset state (#081 regression)"
```
- `hasUI: false`, `phase: "done"`, `doneActions: []`, `doneChecklistShown: false`
- Tracks `statusUpdates` via spy on `updateIssueStatus`
- After 6 `onAgentEnd` calls: `expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }])` ✓
- `expect(finalState.activeIssue).toBeNull()` ✓, `expect(finalState.phase).toBeNull()` ✓

Also: `tests/hooks.test.ts:102–110` (simpler unit test): single call with `hasUI: false` → `doneActions.length > 0` and `doneChecklistShown === true`.

`bun test tests/hooks.test.ts` → 17 pass, 0 fail.

**Verdict: PASS**

---

### Bug #083 — Done-phase checklist fires synchronously inside tool call (UX timing)

---

### Criterion #083-1: `showDoneChecklist` is NOT called inside `megapowers_signal execute()`

**Evidence — grep:**
```
grep -n "showDoneChecklist" extensions/megapowers/register-tools.ts
(no output)
```
Zero matches. The function is not imported or called in `register-tools.ts`.

**Evidence — test at `tests/reproduce-084-batch.test.ts:298–306`:**
```typescript
it("FIX: showDoneChecklist is NOT called inside megapowers_signal execute (#083)", () => {
  const source = readFileSync("extensions/megapowers/register-tools.ts", "utf-8");
  expect(source).not.toContain("showDoneChecklist");
});
```
Test passes.

`bun test tests/reproduce-084-batch.test.ts` → 14 pass, 0 fail.

**Verdict: PASS**

---

### Criterion #083-2: Checklist fires in `onAgentEnd` after the code-review turn completes

**Evidence — code inspection (`extensions/megapowers/hooks.ts:102–107`):**
```typescript
// Deferred done checklist — fires after agent turn completes (#083 fix)
if (phase === "done" && state.doneActions.length === 0 && state.activeIssue && !state.doneChecklistShown) {
  await showDoneChecklist(ctx, ctx.cwd);
  writeState(ctx.cwd, { ...readState(ctx.cwd), doneChecklistShown: true });
  return;
}
```
The checklist is now in `onAgentEnd` (which runs after the full LLM turn completes), not inside the tool `execute()`.

**Evidence — test at `tests/hooks.test.ts:431–463`:**
```
"calls showDoneChecklist when phase=done, doneActions=[], hasUI=true, doneChecklistShown=false"
```
- Sets `phase: "done"`, `doneActions: []`, `doneChecklistShown: false`, `hasUI: true`
- `checklistCalled` flag is set to `true` when `ctx.ui.custom()` is invoked
- Asserts: `expect(checklistCalled).toBe(true)` ✓, `state.doneChecklistShown === true` ✓

**Verdict: PASS**

---

### Criterion #083-3: `doneChecklistShown` is set to `true` on first presentation, preventing re-show on dismiss

**Evidence — code inspection:**
- `hooks.ts:105`: `writeState(ctx.cwd, { ...readState(ctx.cwd), doneChecklistShown: true });` — set after calling `showDoneChecklist`
- `state-machine.ts:55`: `doneChecklistShown: boolean` — field in `MegapowersState`
- `state-machine.ts:89`: `doneChecklistShown: false` — initial state
- `state-machine.ts:151`: `next.doneChecklistShown = false;` — reset on every phase transition

**Evidence — test at `tests/hooks.test.ts:465–493`:**
```
"does NOT call showDoneChecklist when doneChecklistShown=true"
```
- Sets `doneChecklistShown: true`, `doneActions: []`, `hasUI: true`
- `checklistCalled` flag starts `false`
- After `onAgentEnd(...)`: `expect(checklistCalled).toBe(false)` ✓

Also `tests/ui.test.ts` and `tests/state-io.test.ts` confirm `doneChecklistShown` is present in the schema and IO allowlist (`state-io.ts:14`).

**Verdict: PASS**

---

### Criterion #083-4: Test — `onAgentEnd` with `phase=done, doneActions=[], hasUI=true` → checklist invoked; second call with `doneChecklistShown=true` → NOT invoked again

**Evidence — two tests in `tests/hooks.test.ts`:**

First call test (`lines 431–463`):
- `phase: "done"`, `doneActions: []`, `doneChecklistShown: false`, `hasUI: true`
- Asserts: `checklistCalled === true`, `state.doneChecklistShown === true`, `state.doneActions` contains `"generate-docs"` and `"close-issue"`

Second call test (`lines 465–493`):
- `phase: "done"`, `doneActions: []`, `doneChecklistShown: true`, `hasUI: true`
- Asserts: `checklistCalled === false`

Both tests run as part of `bun test tests/hooks.test.ts` → 17 pass, 0 fail.

**Verdict: PASS**

---

## Bug Reproduction Confirmation

### #081 Root Cause Eliminated

The original bug: `showDoneChecklist` had `if (!ctx.hasUI) return;` at line 81. This left `doneActions = []` permanently, causing both `buildInjectedPrompt` and `onAgentEnd` to skip done-phase processing.

**Fix verified:** The early return at `ui.ts:81` is replaced with the headless auto-population block. Grep confirms old pattern absent:
```
grep -n "if (!ctx.hasUI) return" extensions/megapowers/ui.ts
(no output in showDoneChecklist body)
```

### #083 Root Cause Eliminated

The original bug: `showDoneChecklist` was called inside `register-tools.ts execute()` at line 52, synchronously during LLM streaming.

**Fix verified:** `showDoneChecklist` is completely absent from `register-tools.ts`. The deferred call is now in `onAgentEnd` guarded by `!state.doneChecklistShown`.

---

## Overall Verdict

**PASS**

All 8 acceptance criteria are met:
- #081-AC1 through AC4: `showDoneChecklist` headless fix, `onAgentEnd` close-issue execution, `buildInjectedPrompt` injection, and the end-to-end regression test all verified by code inspection + passing tests.
- #083-AC1 through AC4: `showDoneChecklist` removed from tool execute, deferred to `onAgentEnd`, `doneChecklistShown` guard prevents re-show, and both the "show once" and "don't re-show" tests pass.

Full suite: **759 pass, 0 fail** across 72 files.
