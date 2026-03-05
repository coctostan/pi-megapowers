# Brainstorm: Clean Context Windows

## Problem

Phase transitions accumulate stale conversation history in the context window. This degrades LLM output quality — the agent carries contradictory or irrelevant context from earlier phases into new ones. The existing `triggerNewSession` mechanism (used by `plan_draft_done` and `plan_review`) is broken: it uses `(ctx.sessionManager as any)?.newSession?()` instead of the proper `ctx.newSession()` API, passes no setup callback, and is fire-and-forget.

## Approach

Every workflow transition — `phase_next`, `phase_back`, `task_done`, `plan_draft_done`, and `plan_review(approve)` — will trigger a fresh session via the proper `ctx.newSession()` API. No seed message or setup callback is needed because the existing `buildInjectedPrompt` (invoked by `onBeforeAgentStart`) already computes full phase-appropriate context on every agent turn: artifacts, task variables, learnings, tool instructions, and phase-specific prompt templates. The new session simply clears stale conversation; the system prompt injection handles the rest.

The implementation touches two files. In `tool-signal.ts`, `handleSignal` will return `triggerNewSession: true` for all transition actions (`phase_next`, `phase_back`, `task_done`) — not just `plan_draft_done`. In `register-tools.ts`, the `newSession` call will be fixed to use `ctx.newSession()` (the proper API) instead of the defensive `(ctx.sessionManager as any)?.newSession?()` cast.

## Key Decisions

- **All transitions reset** — no per-transition policy table. Every phase change benefits from fresh context. Simpler to implement, no config to maintain.
- **No seed message** — `buildInjectedPrompt` already provides full phase context via system prompt injection on every turn. No duplication needed.
- **No new modules** — this is a fix to existing plumbing, not new architecture.
- **Quality over tokens** — the motivation is cleaner LLM output, not context window savings.

## Components

1. **`tool-signal.ts`** — add `triggerNewSession: true` to `phase_next`, `phase_back`, and `task_done` return values
2. **`tool-plan-review.ts`** — already returns `triggerNewSession: true` for approve; no change needed
3. **`register-tools.ts`** — fix both `newSession` call sites (signal tool + plan-review tool) to use proper `ctx.newSession()` API

## Testing Strategy

- **Unit tests for `handleSignal`** — verify `triggerNewSession: true` is returned for each transition action (`phase_next`, `phase_back`, `task_done`, `plan_draft_done`)
- **Unit tests for `handlePlanReview`** — verify `triggerNewSession: true` on approve (already tested; confirm no regression)
- **Integration-level verification** — the `register-tools.ts` changes are thin glue calling `ctx.newSession()`, tested by confirming the call is made when `triggerNewSession` is set
