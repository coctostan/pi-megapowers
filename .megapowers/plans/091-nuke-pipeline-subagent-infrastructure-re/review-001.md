---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 5
  - 6
  - 7
  - 8
  - 4
approved_tasks:
  - 1
  - 2
  - 3
  - 5
  - 6
  - 7
  - 8
needs_revision_tasks:
  - 4
---

## Summary

7 of 8 tasks pass review. Task 4 needs a single fix: its Step 1 test replacement drops 4 non-legacy tests from the existing describe block.

### Task 4 Issue
Step 1 replaces the `describe("implement prompt — subagent delegation instructions")` block (lines 307–374 of `tests/prompts.test.ts`) with only 4 tests, but the existing block has 8 tests. Four non-legacy tests are silently dropped:
1. "remaining_tasks is sentinel when no tasks remain after current"
2. "remaining_tasks shows tasks as ready when their dependencies are complete"
3. "implement-task template instructs tests_failed signal after RED test failure"
4. "implement-task template instructs tests_passed signal after GREEN test pass"

These test general `buildImplementTaskVars` and template content — not legacy pipeline behavior. Dropping them is an unjustified test coverage regression. The replacement block should have all 8 tests (4 new + 4 preserved).

See `revise-instructions-1.md` for exact test code to add.

### Coverage Notes
- AC 6 (state-machine cleanup): Verified no pipeline/subagent-specific state fields exist — inherently satisfied.
- AC 11 (primary-session flow): Plan correctly avoids modifying state machine or task progression — inherently preserved.
