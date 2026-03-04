# Diagnosis

## Root Cause

Two distinct but related failures in `onAgentEnd` (hooks.ts lines 192–207):

1. **`capture-learnings`**: The `text.length > 100` guard blocks action consumption even though the action has no response-text dependency — the done.md prompt instructs the LLM to call `write()` directly, so the LLM always produces a short acknowledgment response (≈39 chars). The guard was originally an intentional exclusion (`if (doneAction !== "capture-learnings")` that was partially fixed in issue #086 but the underlying protocol mismatch was never resolved.

2. **`write-changelog`**: The done.md prompt says "Return only the entry block" — a minimal valid entry is ~58 chars. This is structurally shorter than the 100-char threshold, guaranteeing that `write-changelog` is never consumed when the LLM follows instructions correctly.

Both actions remain permanently at `doneActions[0]`, blocking all subsequent actions (`push-and-pr`, `close-issue`) from executing.

## Trace

### Dispatch table in `onAgentEnd` (hooks.ts)

```
doneActions[0] value        Handler                         Guard
─────────────────────────── ──────────────────────────────  ──────────────────
"close-issue"               Lines 113–127 (explicit)        None — unconditional
"push-and-pr"               Lines 129–190 (explicit)        None — unconditional
"generate-docs"             Lines 192–207 (text-scraping)   text.length > 100
"generate-bugfix-summary"   Lines 192–207 (text-scraping)   text.length > 100
"write-changelog"           Lines 192–207 (text-scraping)   text.length > 100
"capture-learnings"         Lines 192–207 (no handler)      text.length > 100
```

`close-issue` and `push-and-pr` each have explicit handlers and are consumed unconditionally. The four content-capture actions fall through to a single shared block guarded by `text.length > 100`. Only `generate-docs` and `generate-bugfix-summary` work reliably because the done.md prompt asks the LLM to produce full documents (which are reliably > 100 chars).

### Why the guard was introduced

The guard originated from the original "response-text scraping" design: the LLM was supposed to output the artifact text directly in its response, and the hook would scrape it. The `> 100` threshold filtered out empty/vacuous responses. This works for `generate-docs` / `generate-bugfix-summary` (prompts say "Present the full document in your response").

### `capture-learnings` — historical root

**Commit `319b405`** (issue #072, Feb 26): When `doneMode` was refactored into `doneActions`, the code explicitly excluded `capture-learnings` from consumption:

```typescript
if (doneAction !== "capture-learnings") {
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
}
```

The intent was that `capture-learnings` uses `write()`, so no text scraping needed — but there was **no path to consume the action**. It was stuck from day one.

**Commit `1a30f36`** (issue #086 task-2, Mar 2): Fixed `close-issue` to have its own unconditional handler. As a side effect, removed the `capture-learnings` exclusion — `writeState` now fires for all content-capture actions including `capture-learnings`. But the `text.length > 100` guard still blocks it, because the done.md prompt still tells the LLM to call `write()` (producing a short response).

### `write-changelog` — structural length mismatch

The done.md prompt says: `"Return only the entry block; the system appends it automatically."` The minimal compliant entry:

```
## [Unreleased]
### Fixed
- Fix done-phase deadlock (#090)
```

is 58 characters — structurally shorter than 100. The LLM follows the prompt correctly and still triggers the guard.

### Data flow of a stuck action

```
done.md prompt rendered → LLM executes capture-learnings:
  → calls write(".megapowers/plans/.../learnings.md", "...")  [file written]
  → responds: "I've written the learnings to the file."       [39 chars]
  
onAgentEnd fires:
  doneActions[0] === "capture-learnings"
  lastAssistant.text = "I've written the learnings to the file."
  text.length = 39
  39 > 100 → false
  writeState() NOT called
  doneActions unchanged: ["capture-learnings", "close-issue"]
  
Next turn: same loop, same result. Forever.
```

## Affected Code

| File | Lines | Issue |
|------|-------|-------|
| `extensions/megapowers/hooks.ts` | 192–207 | `text.length > 100` guard prevents consumption |
| `extensions/megapowers/hooks.ts` | 192–207 | No dedicated handler for `capture-learnings` |
| `prompts/done.md` | 45–50 | `capture-learnings` instructs `write()` — incompatible with text-scraping model |
| `prompts/done.md` | 36–43 | `write-changelog` says "Return only the entry block" — valid entries < 100 chars |

## Pattern Analysis

### Working (unconditional) vs broken (guarded) handlers

**`close-issue` — works:**
```typescript
if (doneAction === "close-issue") {
  store.updateIssueStatus(state.activeIssue, "done");
  writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });
  return;                                    // ← no text dependency, always consumed
}
```

**`capture-learnings` — broken:**
```typescript
// No dedicated handler. Falls through to:
if (text && text.length > 100) {
  // No capture-learnings-specific code
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
  // ↑ Only reached when text.length > 100, which is never true for capture-learnings
}
```

**Key difference**: `close-issue` has its own `if` block before the text guard and returns early. `capture-learnings` has no such block. The fix for `close-issue` (issue #086) demonstrated the correct pattern but was not applied to `capture-learnings`.

### Prompt model vs hook model mismatch

| Action | Prompt model | Hook model | Compatible? |
|--------|-------------|-----------|-------------|
| `generate-docs` | Output in response | Scrape text > 100 | ✅ Yes |
| `generate-bugfix-summary` | Output in response | Scrape text > 100 | ✅ Yes |
| `write-changelog` | "Return only the entry block" | Scrape text > 100 | ❌ No (entry < 100) |
| `capture-learnings` | Call `write()` directly | Scrape text > 100 | ❌ No (text ≈ 39 chars) |

## Risk Assessment

**What changes are needed:**

1. **`capture-learnings`**: Add an explicit handler before the text guard (like `close-issue`) that consumes the action unconditionally. The LLM already wrote the file — no text scraping required. Zero content-capture risk.

2. **`write-changelog`**: Two options:
   - **Option A (minimal)**: Lower or remove the `> 100` guard specifically for `write-changelog`. Risk: might append empty/preamble text as changelog.
   - **Option B (correct)**: Move `write-changelog` to unconditional consumption. The LLM writes the file directly (prompt updated) — no text scraping. Matches `capture-learnings` pattern.

**Related risks if changed:**
- The existing test at `hooks.test.ts:120` asserts the buggy behavior ("does nothing when text is shorter than 100 chars" for `capture-learnings`). This test must be updated to assert the correct behavior.
- The existing test at `hooks.test.ts:73` ("removes capture-learnings from doneActions after agent produces long text") was written for the intermediate state where capture-learnings WAS consumed when text > 100. After the fix, it should still pass (unconditional consumption includes long text).
- `generate-docs` / `generate-bugfix-summary`: also theoretically vulnerable if a short feature produces a < 100 char document, but in practice produce long output. The guard currently prevents bad data for these. Consider whether to retain it only for these two.

**What can break if fixed incorrectly:**
- If `write-changelog` is made unconditional but the LLM produces preamble text before/after the entry block, the entire response gets appended to CHANGELOG.md (corrupted entries).
- If `capture-learnings` is made unconditional, it's safe — the LLM wrote the file, nothing else to capture.

**Correct fix is Option A from the issue description**: Remove the `text.length > 100` guard as a *consumption gate* for ALL content-capture actions. Decouple "should content be captured from text" from "should the action be consumed". Specifically:
- `capture-learnings`: consume unconditionally (no text capture needed)
- `write-changelog`: consume when text exists at any length (the entry IS the entire response)
- `generate-docs` / `generate-bugfix-summary`: consume when text exists at any length (risk of short text is low; a `> 0` guard suffices)

## Fixed When

1. `capture-learnings` is consumed from `doneActions` regardless of LLM response length.
2. `write-changelog` is consumed from `doneActions` when the LLM response is non-empty (even if < 100 chars), and `store.appendChangelog()` is called with the entry text.
3. `generate-docs` and `generate-bugfix-summary` remain functional (consumed when text is non-empty; no regression).
4. The test "does nothing when text is shorter than 100 chars" (`hooks.test.ts:120`) is updated to assert that `capture-learnings` IS consumed even on short response.
5. End-to-end: after `capture-learnings` or `write-changelog` completes, `close-issue` fires and `activeIssue` resets to null.
6. The 3 failing tests in `tests/bug090-doneactions-deadlock.test.ts` pass.
