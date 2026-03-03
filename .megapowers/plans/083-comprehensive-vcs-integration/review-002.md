---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 7
  - 8
  - 9
  - 11
  - 6
  - 10
  - 12
  - 13
  - 14
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 7
  - 8
  - 9
  - 11
needs_revision_tasks:
  - 6
  - 10
  - 12
  - 13
  - 14
---

### Task 1: createBranch in git-ops.ts — ✅ PASS
No issues.

### Task 2: checkoutBranch in git-ops.ts — ✅ PASS
No issues.

### Task 3: wipCommit in git-ops.ts — ✅ PASS
No issues.

### Task 4: squashOnto in git-ops.ts — ✅ PASS
No issues.

### Task 5: pushBranch in git-ops.ts — ✅ PASS
No issues.

### Task 6: ensureBranch in branch-manager.ts — ❌ REVISE
- **AC8 mismatch/extra behavior:** ensureBranch currently runs `git rev-parse --abbrev-ref HEAD` to determine a base branch and passes that to `createBranch`. AC8 says “create from the current branch” — you can satisfy that without resolving a branch name at all by using `HEAD` as the base (i.e. `createBranch(execGit, branchName, "HEAD")`).
- **Confusing comment:** Step 3 says callers “must capture baseBranch separately via rev-parse --abbrev-ref HEAD before calling this function”, but the implementation itself already runs that command. This conflicts with Task 12’s separate base-branch capture.
- **Actionable fix:** either (a) remove the internal `rev-parse --abbrev-ref HEAD` call and always create from `HEAD`, or (b) keep it but then Task 12 shouldn’t repeat the capture and the comments/tests should be updated for a single source of truth.

### Task 7: switchAwayCommit in branch-manager.ts — ✅ PASS
No issues (assuming Task 6 API remains `ensureBranch(execGit, slug, workflow)` as planned).

### Task 8: squashAndPush in branch-manager.ts — ✅ PASS
No issues.

### Task 9: createPR in pr-creator.ts — ✅ PASS
No issues.

### Task 10: Add branchName and baseBranch to MegapowersState — ❌ REVISE
- **Spec divergence:** AC13 requires adding `branchName: string | null` and adding it to `KNOWN_KEYS`. The task additionally adds `baseBranch`. That may be a good idea for AC18, but it is **not** in the acceptance criteria list.
- **Actionable fix:** either
  - keep `baseBranch`, but explicitly call out in the task header/body which ACs it supports (AC18) and that it is an *intentional extension* to the spec; or
  - remove `baseBranch` and adjust Tasks 12/14 so `squashAndPush` uses an alternative (but then you must still satisfy the “base branch at activation time” intent from the spec’s out-of-scope notes).

### Task 11: Done checklist push-and-pr item — ✅ PASS
No issues.

### Task 12: ensureBranch on issue activation — ❌ REVISE
- **AC14 location mismatch:** AC14 explicitly says the activation hook is “in `ui.ts`”. The plan wires it in `commands.ts`. That’s likely the right architecture in this repo, but the plan should acknowledge this as an intentional deviation and confirm behavior for both `/issue list` and `/issue new`.
- **Inconsistent graceful-degradation story:** Step 3 adds `ensureDeps` logic that always initializes `execGit`, but Step 1 includes a test case “does nothing when execGit is not provided”. If `ensureDeps` always sets `execGit`, that path won’t happen in real usage.
- **Actionable fix:** decide one:
  - **Option A (recommended):** `ensureDeps` always provides `execGit`, but VCS behavior degrades gracefully via `ensureBranch` (git-dir check) + notifications. In that case, **remove/update** the “no execGit provided” test to match reality.
  - **Option B:** keep `execGit` truly optional (don’t auto-create it in `ensureDeps`), and ensure the rest of the extension never assumes it exists.
- **Optional coverage improvement:** add a second test that exercises the `/issue new` activation path, or state explicitly that the hook triggers on any activation regardless of subcommand.

### Task 13: switchAwayCommit on issue switch — ❌ REVISE
- **Depends on Task 12 design choice:** the wiring/typing changes here need to match whatever you decide in Task 12 about `execGit` optionality.
- **Notify consistency:** some notifications prefix with `VCS:` while others don’t. AC16 only requires severity `"error"`, but consistency would help.

### Task 14: Done action handler for push-and-pr — ❌ REVISE
- **Missing dependency annotation:** this task modifies `extensions/megapowers/commands.ts` again (adds `execCmd`), but it doesn’t list a dependency on Task 12/13 even though those tasks also change commands.ts types. Please add `[depends: 12]` (and likely `[depends: 13]` if it lands after the switch-away wiring).
- **Base branch fallback:** Step 3 uses `const baseBranch = state.baseBranch ?? "main"`. If you keep `baseBranch` nullable, defaulting to `main` could violate the spec’s “base branch is the current branch at activation time” behavior. Consider instead:
  - if `baseBranch` is null: notify and **skip** push-and-pr (consume or keep action—your choice, but be explicit), or
  - make `baseBranch` non-null whenever `branchName` is non-null (set it in Task 12 and test it).
- **PR creation failure behavior not specified:** you consume the action once push succeeds even if PR creation fails. AC19 only constrains squash/push failures; AC20 covers skipped PR. Please clarify intended behavior for a non-skipped PR failure (keep action for retry vs. consume to avoid repeated force-push).

### Missing Coverage
No outright missing acceptance criteria, but the following need clarification/realignment in the plan:
- **AC13 vs baseBranch persistence** (Task 10)
- **AC14 wiring location** (Task 12)

### Overall recommendation
Revise Tasks **6, 10, 12, 13, 14** to resolve the base-branch persistence approach, make `execGit`/`execCmd` optionality consistent with `ensureDeps`, and fix dependency annotations.

