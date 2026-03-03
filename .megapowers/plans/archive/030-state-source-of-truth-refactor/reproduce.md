All existing tests still pass. The new test file has **23 failures and 6 passes** — the 6 passing tests are the positive/guard cases (true questions still detected, non-approval still rejected, extraction works in isolation, stale-state demo). Here's the summary:

---

## Reproduction Results

**Test file:** `tests/030-state-source-of-truth.test.ts`  
**Results:** 23 fail / 6 pass across 29 tests

### Confirmed failing bugs:

| Issue | Failures | What fails |
|---|---|---|
| **#023** | 8 | `hasOpenQuestions` returns `true` for "None", "None.", "N/A", "n/a", "No open questions", "No open questions.", "(none)", "(None)" |
| **#024** | 6 | `processAgentOutput` review phase doesn't set `reviewApproved` for "Plan approved", "LGTM", "Approved", "I approve this plan", or `## Review Result\nApproved` |
| **#017** | 5 | `processAgentOutput` implement phase doesn't detect `[no-test]` task completion from "nothing to do", "already exists", "no changes needed" |
| **#019** | 4 | `processAgentOutput` doesn't match "Task 1 Complete", "Task 1 is done", "Completed Task 1", or `## Task 1 Complete` |
| **#029** | 0 fail (documented) | The stale-state overwrite test passes because it *demonstrates* the architectural problem — `processAgentOutput` operates on stale in-memory state, re-completing task 1 instead of task 2 |
| **#006** | 0 fail (documented) | Extraction works in isolation; the loss happens at the `session_shutdown` boundary when file state has advanced past memory state |

### Architectural issues (not unit-testable without mocking `index.ts`):

- **#021/#029**: The in-memory `state` variable in `index.ts` is the runtime source of truth, but `state.json` is the persistence layer. These diverge silently. The `session_shutdown` handler has heuristic guards but they're insufficient.
- **#006**: Criteria are extracted correctly by `processAgentOutput`, but can be lost when `session_shutdown` skips saving because file state has a more-advanced phase.

The reproduce report is saved to `.megapowers/plans/030-state-source-of-truth-refactor/reproduce.md` and all 23 failing tests are in `tests/030-state-source-of-truth.test.ts`.