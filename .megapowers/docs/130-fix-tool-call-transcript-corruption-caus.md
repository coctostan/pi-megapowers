# Fix: preserve tool-call transcripts across workflow transitions (#130)

## Root cause

Megapowers called the raw session manager's newSession() from the registered megapowers_signal and megapowers_plan_review execute callbacks. Pi had already persisted the assistant tool call but had not yet persisted its result. Clearing canonical storage at that boundary left an orphaned tool result in the next provider request, causing errors such as “No tool call found for function call output.”

Symbol inspection confirmed registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void in extensions/megapowers/register-tools.ts:13, with calls to handleSignal, handlePlanDraftDone, and handlePlanReview. The low-level storage reset was not a supported agent-runtime replacement.

## Fix

- Remove both callback resets and the obsolete triggerNewSession fields/return values.
- Preserve the current session through phase/task transitions, draft submission, and review approve/revise.
- Keep existing gates, task/TDD sequencing, artifact versioning, and review state effects.
- Replace reset-required tests with call/result persistence guarantees, including sibling result orders and nested outer calls.
- Correct tool descriptions, next-step messages, and session documentation.

Clean context is now explicitly user-initiated with /new between runs. The next agent start builds context from current disk state; transitions do not reinject a new phase prompt inside an already-running tool loop. Reload the updated extension before using transitions. Historical orphaned transcripts are not repaired and may need a one-time /new.

## Changed files

Runtime:
- extensions/megapowers/register-tools.ts
- extensions/megapowers/tools/tool-signal.ts
- extensions/megapowers/tools/tool-plan-review.ts
- extensions/megapowers/plan-orchestrator.ts

Regression coverage:
- tests/tool-session-transcript.test.ts
- tests/new-session-wiring.test.ts
- tests/tool-signal.test.ts
- tests/tool-plan-review.test.ts
- tests/register-tools.test.ts

Guidance:
- README.md
- AGENTS.md
- .megapowers/docs/080-clean-context-windows.md (superseded historical policy)
- docs/session-compatibility.md

## Verification

Run bun test and the disposable installed-manager/provider smoke commands in docs/session-compatibility.md. Never reset the active session or repeat task completion in a real project to reproduce this bug.

Verification recorded 868 passing tests, zero failures, and 56 persistence fixtures spanning 14 workflow/control cases and four layouts. The real installed Pi 0.99.2 manager reproduced the orphan against pre-fix HEAD and preserved the call/result pair with current source. A next-task smoke confirmed subsequent agent-start context names Task 2 after completing Task 1.

A fresh live openai-codex/gpt-5.5 session completed phase_next, a follow-up read, and a final reply without changing sessions or producing orphaned results. The Anthropic live attempt was blocked by usage quota; Anthropic continuation is not claimed as validated.

Full evidence: .megapowers/plans/130-fix-tool-call-transcript-corruption-caus/verify.md.
