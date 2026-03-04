# Learnings — Issue #090

- **Guard conditions must match the prompt's execution model.** The `text.length > 100` guard assumed all content-capture actions produce long response text, but `capture-learnings` instructs the LLM to call `write()` directly (short acknowledgment) and `write-changelog` asks for "only the entry block" (structurally < 100 chars). When adding a guard, verify it against every code path that reaches it — not just the one you're testing at the time.

- **Explicit per-action handlers are more robust than shared fallthrough blocks.** `close-issue` and `push-and-pr` worked because they had their own `if` blocks with early returns. The four content-capture actions sharing a single guarded block meant one bad guard affected all of them. The #086 fix for `close-issue` demonstrated the correct pattern but it wasn't applied to `capture-learnings` at the time — a missed generalization.

- **Tests that assert buggy behavior are dangerous.** `hooks.test.ts:120` ("does nothing when text is shorter than 100 chars") codified the deadlock as correct behavior. This made the bug invisible to CI and gave false confidence. When writing tests for edge cases, ask: "is this the *desired* behavior or just the *current* behavior?"

- **The `doneActions` queue's sequential processing (only `[0]` per turn) amplifies stuck-action bugs.** A single permanently-stuck action blocks everything downstream. This is the same pattern as #087 (push-and-pr stuck → close-issue blocked). Any new done-action handler should be reviewed specifically for "can this action get permanently stuck?"

- **Lowering `> 100` to `> 0` is safe because the prompt already controls content quality.** The original threshold was a crude filter against empty/vacuous responses. But the done.md prompts are specific enough that the LLM reliably produces meaningful content. A `> 0` guard (non-empty check) is sufficient — the prompt is the real quality gate, not a character count.

- **Historical git archaeology (`git log --all --oneline -- <file>`) is invaluable for diagnosis.** Tracing the `capture-learnings` exclusion back to commit `319b405` (issue #072) and the partial fix in `1a30f36` (issue #086) revealed the exact sequence of decisions that created and then partially fixed the bug. Without that trace, the root cause would have been much harder to identify.
