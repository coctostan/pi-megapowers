# Learnings — 080-clean-context-windows

- **Small return-value changes can have outsized UX impact.** Adding `triggerNewSession: true` to four handler return paths was a trivial code change (~4 lines), but the effect — a clean context window at every phase boundary — significantly improves agent output quality. The heavy lifting was already done by `buildInjectedPrompt`.

- **Broken `parentSession` was silently a no-op.** `getSessionFile()` doesn't exist on `ReadonlySessionManager`, so the old call `(ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined })` simply invoked `newSession` with `undefined` as the argument. Removing it was correct, but the silent failure masked the bug for a long time — optional-chaining on `as any` casts makes failures invisible.

- **Moving done-phase actions from hook to LLM eliminated an entire class of liveness bugs.** The hook-driven loop was inherently fragile: it processed one action per `onAgentEnd` call, could deadlock if an action didn't consume, and had no visibility into failures. Making the LLM the executor (with the hook merely setting up context) reduces moving parts and makes the flow inspectable.

- **`createInitialState()` spread is the right pattern for state reset.** `{ ...createInitialState(), megaEnabled: state.megaEnabled }` gives a guaranteed-complete reset with a single intentional preservation. Spreading partial overrides onto old state risks leaving stale fields.

- **Source-text tests guard removal of critical code, but they're a maintenance liability.** Tests that `expect(source).not.toContain("squashAndPush")` are useful immediately after a deletion refactor (they ensure the dead code doesn't creep back) but become noise once the risk window passes. Consider time-boxing them or converting to behavioral equivalents.

- **Spec AC wording vs. API constraints:** AC10/11 specified `ctx.newSession()` but `ExtensionContext.sessionManager` is a `ReadonlySessionManager` that excludes `newSession`. Catching this in the plan (Task 9 note) before implementation prevented a false-failure loop. When writing ACs, note which API methods you're assuming exist.

- **Scope creep can be coherent and desirable.** The `close_issue` signal and done-phase refactor were beyond the 080 spec, but they were tightly coupled to making `triggerNewSession` meaningful for the done phase. Keeping them together produced a cleaner result than two separate PRs would have.
