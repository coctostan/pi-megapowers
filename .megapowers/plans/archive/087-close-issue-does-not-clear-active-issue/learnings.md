# Learnings — 087-close-issue-does-not-clear-active-issue

- **`{ ...state, fieldToUpdate }` is a partial-update pattern, not a reset pattern.** Spreading existing state is correct for field mutations (e.g. updating `doneActions`) but silently wrong for transitions that require nulling out groups of related fields. The fix: use `createInitialState()` as the *base* and spread only what should survive (e.g. `megaEnabled`). The same discipline applies to any state transition that changes "mode" — activation (`ui.ts`) already did this correctly and served as the reference.

- **Immediate actions in a queue must not be gated on side-effect availability.** `close-issue`, `capture-learnings`, and `squash-task-changes` don't require LLM-generated text. Wrapping the entire queue-processing block in `if (text && text.length > 100)` turns a content guard into a liveness gate — actions with nothing to gate on get stuck permanently. The fix: classify actions as content-capture vs. immediate and only apply the text guard to the former.

- **`createInitialState()` as an authoritative idle baseline.** Because `createInitialState()` already existed and was used at install time, using it in `close-issue` was a one-liner. If the state shape ever gains new fields, the function is the single place to update — no close-issue handler to update separately. Centralizing the "what does idle look like?" question pays dividends here.

- **A failing test that already exists is worth adopting, not deleting.** The test file `hooks-close-issue.test.ts` was written before the fix and intentionally failing. Treating it as a spec rather than dead code meant zero test-writing effort and a clear red→green signal. Planned failing tests are a legitimate TDD artifact.

- **Return-early on `close-issue` prevents stale dashboard renders.** Without `return`, the handler would fall through to the `renderDashboard` call at the bottom of `onAgentEnd`, which would receive the stale pre-reset state snapshot. The early return avoids a confusing flash of "done" UI followed immediately by idle state on the next read.

- **Bug clusters: two independent bugs, one symptom.** Bug 1 (wrong write) and Bug 2 (text-length gate) both needed to exist to manifest the stuck-session symptom — Bug 1 caused the wrong state, Bug 2 ensured the action was never consumed. Fixing only Bug 1 would have fixed the primary symptom but left `capture-learnings` and `squash-task-changes` silently non-functional for short LLM responses. Diagnosis that identifies root-cause chains, not just the terminal failure, matters.
