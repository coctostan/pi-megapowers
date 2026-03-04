---
id: 90
type: bugfix
status: done
created: 2026-03-04T15:21:47.022Z
milestone: M1
priority: 1
---
# Done-phase content-capture actions never consumed — permanent doneActions deadlock
## Problem

Done-phase wrap-up actions (`write-changelog`, `capture-learnings`, `generate-docs`, `generate-bugfix-summary`) are **never consumed from `doneActions`**, permanently blocking `push-and-pr` and `close-issue`. The issue never closes and `state.json` never resets.

## Root Cause

The `onAgentEnd` hook processes content-capture actions by reading the last assistant message text and checking `text.length > 100`:

```typescript
// hooks.ts lines 192-207
const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
if (lastAssistant) {
  const text = getAssistantText(lastAssistant);
  if (text && text.length > 100) {
    if (doneAction === "write-changelog") store.appendChangelog(text);
    writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
  }
  // ← If text.length <= 100: NO CONSUMPTION. Action stays at doneActions[0]. Forever.
}
```

The LLM (following done-phase prompt instructions) uses `write()` / `edit()` tool calls to persist content (changelog, learnings), then produces a short textual response summarizing what was done. The hook sees `text.length < 100` and never consumes the action.

## Protocol Mismatch

The done-phase prompt is **self-contradictory**:

- `write-changelog` says: **"Return only the entry block; the system appends it automatically."** — implies LLM should output text in response, not write files
- `capture-learnings` says: **`write({ path: "...learnings.md", content: "..." })`** — implies LLM should write the file itself
- `generate-bugfix-summary` says: **"Present the full summary in your response; the system persists it"** — implies output-in-response again

Mixed signals: some actions expect output-in-response (hook grabs the text), others expect direct file writes. When the LLM writes files and produces a short response, the hook's `text.length > 100` guard blocks consumption.

Additionally: `store.appendChangelog(text)` appends the **entire** response as the changelog entry — if the LLM mixes analysis text with the changelog block, corrupted entries result.

## Additionally: `capture-learnings` Has No Hook Handler

```typescript
if (doneAction === "generate-docs" || doneAction === "generate-bugfix-summary") { ... }
if (doneAction === "write-changelog") { ... }
writeState(...); // consumes action if text > 100 — even for capture-learnings, generate-docs, etc.
```

`capture-learnings` has no dedicated handler. The hook consumes it as a no-op (only calls `writeState`) — which is fine if the LLM writes the file directly. But it still requires `text.length > 100`.

## Impact

Every done-phase workflow that includes content-capture actions leaves `doneActions` permanently stuck, blocking `close-issue`, leaving `state.json` unreset, and `activeIssue` non-null forever. Happened on issues #087, #086, and earlier.

## Fix Options

**Option A (minimal):** Remove the `text.length > 100` guard for action consumption. The action is always consumed regardless of response length. Content capture only happens if text is long enough. This separates "was content captured" from "should action be consumed."

**Option B (correct):** Replace content-capture via response-text-scraping with explicit artifact writes. Each content action tells the LLM to write a file directly, and the hook consumes the action unconditionally after the turn (checking for file existence, not response length).

**Option C (prompt-fix only):** Standardize all content-capture actions to output-in-response model (no `write()` calls). Dangerous — response text includes analysis, preamble, etc., which would be captured verbatim.

Option A is the minimal safe fix. Option B is correct long-term.
