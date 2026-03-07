---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 10
  - 12
  - 15
  - 16
  - 18
  - 9
  - 13
  - 17
approved_tasks:
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 10
  - 12
  - 15
  - 16
  - 18
needs_revision_tasks:
  - 9
  - 13
  - 17
---

### Per-Task Assessment

### Task 2: Extract switch-away persistence helper for clean working trees — ✅ PASS
No blocking issues. API references (`switchAwayCommit`, `handleIssueCommand`) align with current codebase.

### Task 3: Add shipment audit for tracked, untracked, and ignored files — ✅ PASS
Good foundation. `ExecGit` and parsing approach match existing VCS helper patterns.

### Task 4: Abort finalization on suspicious untracked files before push — ✅ PASS
Behavior and error shape are coherent with Task 3 outputs.

### Task 5: Reject invalid shipping branch targets before squashing or pushing — ✅ PASS
Validation contract is clear and implementation signature is feasible.

### Task 6: Commit allowed dirty work during shipment finalization — ✅ PASS
Correct staging flow (`add -u`, then explicit included untracked paths), and re-check-before-commit is sound.

### Task 7: Extract squash-only shipping step and stop on squash failures — ✅ PASS
Helper extraction is architecturally sound and compatible with current `branch-manager.ts`/`git-ops.ts` API boundaries.

### Task 8: Pass base branch into PR creation and preserve clear skip/error results — ✅ PASS
Signature update is correct and test updates are scoped appropriately.

### Task 9: Orchestrate finalize, squash, push, and PR as one shipping path — ❌ REVISE
- Step 1 mixes multiple behaviors in one test (happy path + validation). Split for granularity.
- AC14 is not actually proven: separate `gitCalls`/`cmdCalls` arrays do not establish cross-system ordering (push before gh check).
- AC15 coverage gap: no explicit test that push failure prevents PR attempt.

### Task 10: Update the done prompt to call the code-owned shipping helper — ✅ PASS
Prompt wiring + CLI entrypoint are self-contained and testable.

### Task 12: Stop the shipping pipeline before push/PR when finalization aborts — ✅ PASS
Finalization guard placement and failure shape are correct.

### Task 13: Surface PR creation failures without hiding a successful push — ❌ REVISE
- Step 1 combines two independent behaviors (PR failure + gh-missing skip) in one `it(...)` block; split to satisfy granularity.
- This task should focus on AC17 only; gh-missing skip is already covered earlier.

### Task 15: Extend VCS coverage with a real-git lifecycle regression — ✅ PASS
High-value integration regression; API usage and flow are feasible.

### Task 16: Record a non-feature base branch during activation — ✅ PASS
Uses correct command APIs and preserves stale-branch cleanup behavior.

### Task 17: Add an automated coverage audit for VCS lifecycle test suites — ❌ REVISE
- Non-deterministic RED step: expected failure rationale is stale given current dependencies.
- Architectural concern: nested `spawnSync("bun", ["test", ...])` inside tests is brittle/heavy.
- Coverage approach is structural-string matching of test names, not behavior-level runtime verification.

### Task 18: Extract a testable ship-cli runner — ✅ PASS
Good extraction for testability; aligns with Task 10 ownership.

### Missing Coverage
- **AC14** is only partially covered. Current Task 9 assertions do not prove that PR creation/checks occur strictly after a successful push.
- **AC15** is not explicitly covered by a task-level test asserting that PR creation is skipped when push fails.

### Verdict
**revise** — Task 9, Task 13, and Task 17 need targeted changes before implementation.
