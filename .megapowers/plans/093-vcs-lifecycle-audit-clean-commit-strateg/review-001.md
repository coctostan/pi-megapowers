---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 3
  - 8
  - 10
  - 15
  - 18
  - 1
  - 2
  - 4
  - 5
  - 6
  - 7
  - 9
  - 11
  - 12
  - 13
  - 14
  - 16
  - 17
approved_tasks:
  - 3
  - 8
  - 10
  - 15
  - 18
needs_revision_tasks:
  - 1
  - 2
  - 4
  - 5
  - 6
  - 7
  - 9
  - 11
  - 12
  - 13
  - 14
  - 16
  - 17
---

### Per-Task Assessment

### Task 1: Export a branch-creation helper result through activation state — ❌ REVISE
- Step 1 is not RED. `tests/vcs-commands.test.ts` already has an activation-success test that asserts `branchName` and `baseBranch` persistence; the proposed new test will already pass on the current code.
- Step 2's expected failure is therefore inaccurate.
- Revise by removing this task or replacing it with a truly missing behavior.

### Task 2: Extract switch-away persistence helper for clean working trees — ❌ REVISE
- Step 1 says to append a new `import` into `tests/vcs-commands.test.ts`; appending an import mid-file will produce invalid TypeScript.
- Update the existing top import instead of appending a new import block.
- Implementation approach is otherwise sound.

### Task 3: Add shipment audit for tracked, untracked, and ignored files — ✅ PASS
No issues.

### Task 4: Abort finalization on suspicious untracked files before push — ❌ REVISE
- Same mid-file import problem as Task 2: `import { finalizeShipment ... }` cannot be appended in the middle of `tests/shipping.test.ts`.
- Update the top import list created in Task 3 instead.

### Task 5: Reject invalid shipping branch targets before squashing or pushing — ❌ REVISE
- Same mid-file import problem: `import { validateShipTarget ... }` must be folded into the file header, not appended after executable code.
- Implementation/API shape is otherwise feasible.

### Task 6: Commit allowed dirty work during shipment finalization — ❌ REVISE
- Not RED as written. Task 4 Step 3 already contains the exact `add -u` / add included untracked / second `status --porcelain` / `commit` sequence that Task 6 claims to introduce.
- Step 2's expected failure is inaccurate because the Task 6 test would already pass after Task 4.
- Split ownership cleanly: Task 4 should own blocked-file handling and clean-tree no-op; Task 6 should add the staging + second-status + commit path.

### Task 7: Extract squash-only shipping step and stop on squash failures — ❌ REVISE
- Step 1 again appends an import into an existing test file. Update the existing top import in `tests/branch-manager.test.ts` instead.
- The helper extraction itself is otherwise sound.

### Task 8: Pass base branch into PR creation and preserve clear skip/error results — ✅ PASS
No issues.

### Task 9: Orchestrate finalize, squash, push, and PR as one shipping path — ❌ REVISE
- Step 1 test imports `type ExecCmd` from `shipping.js`, but Step 3 does not export that type from `extensions/megapowers/vcs/shipping.ts`.
- The test body also uses `ExecGit` without importing it.
- As written, the file will fail to compile before it reaches the intended missing-export failure.
- Fix by importing `ExecGit` from `git-ops.ts` and `ExecCmd` from `pr-creator.ts`, or explicitly re-export both from `shipping.ts`.

### Task 10: Update the done prompt to call the code-owned shipping helper — ✅ PASS
No issues.

### Task 11: Add a self-contained dirty switch-away regression test — ❌ REVISE
- Dependency issue: Step 3 uses `resolveActivationBaseBranch(...)`, but the task depends only on 1 and 2; that helper is introduced later in Task 16.
- RED issue: the current `handleIssueCommand()` already awaits switch-away persistence before base-branch resolution and `ensureBranch()`, so the proposed ordering assertion is already true today.
- Revise by removing this task or rewriting it into a stricter ordering test that actually fails without the intended refactor.

### Task 12: Stop the shipping pipeline before PR creation when squash or push fails — ❌ REVISE
- Not RED as written. Task 9 Step 3 already preserves `pushed.step` and returns early before PR creation:
  ```ts
  if (!pushed.ok) {
    return { ok: false, step: pushed.step, error: pushed.error, pushed: false };
  }
  ```
- The real missing orchestrator coverage is AC10: if `finalizeShipment()` aborts, `shipAndCreatePR()` must not push and must not attempt PR creation.
- Repurpose this task to cover finalize-abort behavior instead of the already-implemented squash/push branch.

### Task 13: Surface PR creation failures without hiding a successful push — ❌ REVISE
- Not RED as written. Task 9 already contains the explicit PR-error branch:
  ```ts
  if ("ok" in pr && pr.ok === false) {
    return { ok: false, step: "pr", error: pr.error, pushed: true, pr };
  }
  ```
- Remove this task or move that PR-error branch out of Task 9 so Task 13 becomes the first task that introduces it.

### Task 14: Keep branch metadata empty when activation branch creation fails — ❌ REVISE
- Not RED as written. The current code already only assigns branch metadata inside the successful `"branchName" in result` branch, and the proposed test's `makeMockUI()` returns `createInitialState()`, so `branchName` and `baseBranch` are already null on failure.
- Step 3 also references `resolveActivationBaseBranch()` without depending on Task 16.
- Remove this task rather than keeping a green-on-arrival task.

### Task 15: Extend VCS coverage with a real-git lifecycle regression — ✅ PASS
No issues.

### Task 16: Record a non-feature base branch during activation — ❌ REVISE
- The helper extraction is reasonable, but Step 3's replacement logic is oversimplified and would regress existing behavior.
- Current `handleIssueCommand()` already handles stale `feat/*`/`fix/*` branches by checking out `main`, and it also runs the `checkBranchSync()` / optional `git pull` flow. The proposed helper body drops that behavior.
- Revise this task so `resolveActivationBaseBranch()` is extracted from the current inline logic without removing stale-branch cleanup or the later remote-sync prompt.

### Task 17: Add an automated coverage audit for VCS lifecycle test suites — ❌ REVISE
- Once Task 12 is corrected to cover orchestrator-level finalization aborts, this audit should assert that the new shipping test is present too.
- As written, the audit checks suspicious-file classification and squash/push gating, but not the acceptance-criterion-level guarantee that a finalization abort stops shipping before push.

### Task 18: Extract a testable ship-cli runner — ✅ PASS
No issues.

### Missing Coverage
- **AC10** is not covered by any task as written: there is no orchestrator-level test proving that when `finalizeShipment()` aborts, `push-and-pr` does not attempt `git push` and does not attempt PR creation.

### Verdict
- **revise** — several tasks are either not actually RED on the current codebase, have invalid test-file edit instructions (mid-file imports), or reference helpers before their prerequisites exist. See `revise-instructions-1.md` for task-specific fixes and replacement code.
