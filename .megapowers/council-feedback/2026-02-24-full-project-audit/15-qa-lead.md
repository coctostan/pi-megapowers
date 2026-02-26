---
persona: QA Lead
date: 2026-02-24
topic: Full project audit — quality and edge case analysis
---

# QA Lead — "The Edge Case Hunter"

The happy path looks solid. What worries me is every path that isn't happy.

**State corruption scenarios:**
- What happens if `state.json` is manually edited to set `phase: "done"` while in brainstorm? Does the system validate state consistency on read, or does it trust whatever's on disk? From reading `state-io.ts`, it strips unknown keys but doesn't validate phase against workflow progression. A corrupted phase value would be accepted.
- What if an artifact file (`spec.md`) is deleted after passing its gate? The gate checked at transition time, but if the file disappears before the next phase reads it, derived data returns empty. There's no continuous validation.
- What if two pi sessions run in the same directory? Both read state, both write state. The atomic write prevents corruption but not lost updates. Session A advances to plan, Session B (still reading brainstorm state) overwrites back to brainstorm.

**TDD bypass paths:**
- The test runner detection uses string matching on bash output. What if I run `echo "0 fail" && write production_code.ts`? Does the "fail" in the echo trigger test-failed state?
- What about test files that import production code and fail at import time (module not found) — that's a test "failure" but not a meaningful TDD red. The system can't distinguish.
- What if I write a test that's syntactically valid but tests nothing (`test("placeholder", () => {})`), then write production code? The system only checks that a test file was written and the runner was invoked.

**Workflow edge cases:**
- What happens if `plan.md` is modified mid-implement (adding/removing tasks)? `deriveTasks()` will return a different task list. `completedTasks` indices might not match. Task 3 of 5 could become task 3 of 4.
- Backward transition from verify → implement: does it reset `completedTasks`? Which tasks need re-doing? The system doesn't track WHY verify failed or which tasks are affected.

**3 tests currently failing.** I'd want to see those fixed before any new features. A tool that enforces testing discipline needs to model it.
