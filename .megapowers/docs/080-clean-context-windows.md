# Feature: Clean Context Windows (#080)

## Summary

Every workflow phase transition now triggers a fresh session, giving the agent a clean context window at the start of each phase and task. Previously, only `plan_draft_done` and the plan-review `revise` verdict triggered new sessions — and via a broken mechanism that passed a non-existent `parentSession` argument. This change makes session resets universal and correct.

## Problem

Long sessions accumulate stale context: brainstorm exploration pollutes the spec phase, failed plan iterations pollute implementation, and multi-task implement sessions carry forward irrelevant earlier-task history. The agent's output quality degrades as context grows. `buildInjectedPrompt` already provides full phase-appropriate context on every turn, so the prior-session conversation history is pure noise.

The old `newSession` call in `register-tools.ts` also passed `{ parentSession: getSessionFile() }` — using `getSessionFile`, a method that doesn't exist on `ReadonlySessionManager`. The call silently did nothing when the cast failed.

## What Was Built

### Core: `triggerNewSession` propagation (`tool-signal.ts`, `tool-plan-review.ts`)

`SignalResult` already had a `triggerNewSession?: boolean` field used by `plan_draft_done` and plan-review `revise`. Extended this to all successful phase-transition actions:

- `handlePhaseNext` → `{ triggerNewSession: true }` on success
- `handlePhaseBack` → `{ triggerNewSession: true }` on success  
- `handleTaskDone` (advance to next task) → `{ triggerNewSession: true }`
- `handleTaskDone` (all tasks done → verify) → `{ triggerNewSession: true }`
- `handleApproveVerdict` (plan-review approve) → `{ triggerNewSession: true }` *(previously missing)*

Non-transition actions (`tests_failed`, `tests_passed`, `close_issue`) and all error paths do **not** set this flag.

### Fix: simplified `newSession` call (`register-tools.ts`)

Replaced the broken call pattern:
```ts
// Before (broken — getSessionFile doesn't exist on ReadonlySessionManager)
const parent = ctx.sessionManager?.getSessionFile?.();
(ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });

// After (correct — no parentSession needed; buildInjectedPrompt provides context)
(ctx.sessionManager as any)?.newSession?.();
```

### New signal action: `close_issue` (`tool-signal.ts`)

Moved done-phase issue closing from an implicit `onAgentEnd` hook into an explicit `megapowers_signal({ action: "close_issue" })` tool call. The LLM now owns the done-phase flow end-to-end, calling `close_issue` as the final wrap-up step.

### Done-phase architecture refactor (`hooks.ts`, `prompts/done.md`, `prompt-inject.ts`)

Removed all automatic done-phase action processing from `onAgentEnd` (the multi-turn hook loop that drove `close-issue`, `push-and-pr`, `capture-learnings`, etc.). Replaced with a single-turn LLM-driven flow: the `done.md` prompt instructs the agent to execute all selected actions in one turn using its own tools, then call `megapowers_signal({ action: "close_issue" })`.

Added `{{branch_name}}` and `{{base_branch}}` interpolation to the done-phase prompt so the agent can run `git push origin {{branch_name}}` directly.

## Files Changed

| File | Change |
|---|---|
| `extensions/megapowers/tools/tool-signal.ts` | +`triggerNewSession: true` to 4 handlers; +`handleCloseIssue`; +`close_issue` dispatch |
| `extensions/megapowers/tools/tool-plan-review.ts` | +`triggerNewSession: true` to `handleApproveVerdict` |
| `extensions/megapowers/register-tools.ts` | Simplified `newSession` calls (×2); added `close_issue` to schema |
| `extensions/megapowers/hooks.ts` | Removed done-phase action processing loop (~110 lines) |
| `extensions/megapowers/prompt-inject.ts` | Added `branch_name`/`base_branch` vars for done phase |
| `prompts/done.md` | Rewritten for single-turn LLM-driven execution |
| `prompts/megapowers-protocol.md` | Documented `close_issue` signal |
| `tests/tool-signal.test.ts` | +75→843 tests; new `triggerNewSession` + `close_issue` suites |
| `tests/tool-plan-review.test.ts` | +`triggerNewSession on approve` test |
| `tests/new-session-wiring.test.ts` | +3 integration tests; updated cast assertion |
| `tests/hooks.test.ts` | Removed legacy done-action processing tests |
| `tests/reproduce-084-batch.test.ts` | Removed obsolete control test |
| `tests/reproduce-086-bugs.test.ts` | Removed legacy done-action reproduction tests |

Net: **465 insertions, 1002 deletions** — substantial cleanup of hook complexity.

## Why It Matters

- Every phase and task transition now starts with a clean, focused context window
- The `buildInjectedPrompt` system was already designed to provide complete context on each turn — the new sessions unlock this fully
- The done-phase refactor eliminates the multi-turn liveness issues that caused bugs #081, #084, #087, and #090
- Full test suite: **843 pass, 0 fail**
