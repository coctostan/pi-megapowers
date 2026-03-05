# Spec: Clean Context Windows

## Goal

Phase transitions accumulate stale conversation history in the context window, degrading LLM output quality. Currently, only `plan_draft_done` and `plan_review(revise)` trigger new sessions, and they do so via a broken mechanism (`(ctx.sessionManager as any)?.newSession?()` — an unsafe cast bypassing the type system). This change ensures every workflow transition (`phase_next`, `phase_back`, `task_done`, `plan_draft_done`, and `plan_review`) triggers a fresh session via a proper API call, so the agent starts each phase/task with clean context while `buildInjectedPrompt` provides full phase-appropriate context on every turn.

## Acceptance Criteria

1. `handleSignal` returns `triggerNewSession: true` when `phase_next` succeeds
2. `handleSignal` returns `triggerNewSession: true` when `phase_back` succeeds
3. `handleSignal` returns `triggerNewSession: true` when `task_done` succeeds and advances to the next task
4. `handleSignal` returns `triggerNewSession: true` when `task_done` succeeds and auto-advances to verify (all tasks complete)
5. `handleSignal` continues to return `triggerNewSession: true` when `plan_draft_done` succeeds (no regression)
6. `handlePlanReview` continues to return `triggerNewSession: true` when verdict is `approve` (no regression)
7. `handlePlanReview` continues to return `triggerNewSession: true` when verdict is `revise` (no regression)
8. `handleSignal` does NOT return `triggerNewSession` on error results (any action)
9. `handleSignal` does NOT return `triggerNewSession` for non-transition actions (`tests_failed`, `tests_passed`, `close_issue`)
10. The signal tool handler in `register-tools.ts` calls `ctx.newSession()` (not `(ctx.sessionManager as any)?.newSession?()`) when `triggerNewSession` is set
11. The plan-review tool handler in `register-tools.ts` calls `ctx.newSession()` (not `(ctx.sessionManager as any)?.newSession?()`) when `triggerNewSession` is set

## Out of Scope

- Seed messages or setup callbacks for the new session — `buildInjectedPrompt` already provides full context
- Per-transition policy table or configuration for which transitions reset — all transitions reset uniformly
- Context window size optimization or token savings — the goal is output quality, not token efficiency
- Changes to `handlePlanReview` return values — it already returns `triggerNewSession: true` correctly
- Subagent/pipeline session management — those run in isolated worktrees with independent sessions

## Open Questions

*None.*
