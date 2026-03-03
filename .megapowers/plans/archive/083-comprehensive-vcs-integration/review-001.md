---
type: plan-review
iteration: 1
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

### Per-Task Assessment

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
- **AC8 return shape mismatch:** AC8 requires `ensureBranch(...)` returns `{ branchName: string } | { error: string }`, but the task’s test + implementation return `{ branchName, baseBranch }` when creating a branch.
- **Knock-on:** Later tasks (12, 14) rely on `baseBranch` being returned/persisted; that’s not in the spec.
- Fix: either (a) update this task to return exactly `{ branchName }` (no `baseBranch`) and adjust downstream tasks accordingly, or (b) if you truly need baseBranch persisted, call that out explicitly and adjust acceptance-criteria mapping (but as written it conflicts with AC8).

### Task 7: switchAwayCommit in branch-manager.ts — ✅ PASS
No issues.

### Task 8: squashAndPush in branch-manager.ts — ✅ PASS
No issues.

### Task 9: createPR in pr-creator.ts — ✅ PASS
No issues.

### Task 10: Add branchName and baseBranch to MegapowersState — ❌ REVISE
- **AC13 mismatch:** AC13 requires adding `branchName: string | null` and persisting it (incl. `KNOWN_KEYS`) with default `null`. The plan also adds **`baseBranch`** (not in AC13).
- This is also coupled to Task 6’s non-spec `baseBranch` return.
- Fix: limit this task to `branchName` only (per AC13), **or** if you keep `baseBranch`, explicitly justify it and ensure the rest of the plan/spec alignment is updated (right now it’s unaccounted scope).

### Task 11: Done checklist push-and-pr item — ✅ PASS
No issues.

### Task 12: ensureBranch on issue activation — ❌ REVISE
- **Wrong integration point vs spec (AC14):** AC14 explicitly says `ensureBranch` is called when an issue is activated **in `ui.ts`** (activation via `/issue list` or `/issue new`). This task implements it in `extensions/megapowers/commands.ts`.
- **State expectation drift:** test expects `state.baseBranch === "main"`, which is not required by the spec and depends on Task 6/10 changes.
- Fix: move/plan the hook-up in `extensions/megapowers/ui.ts` where the issue activation actually occurs (or update plan text to match the spec’s required location), and remove baseBranch assertions unless spec-updated.

### Task 13: switchAwayCommit on issue switch — ❌ REVISE
- **Wrong integration point vs spec (AC15):** AC15 says on issue switch, `switchAwayCommit` is called with current `branchName` **before activating the new issue’s branch**; the spec again points to the activation flow in `ui.ts`, but this task wires it in `commands.ts`.
- Fix: plan the wiring in `ui.ts` (or explicitly show where the UI activation handler is invoked and why commands.ts is the correct locus per the codebase), and keep logic consistent with the spec.

### Task 14: Done action handler for push-and-pr — ❌ REVISE
- **Bad type import in Step 1:** it imports `ExecGit` from `../extensions/megapowers/subagent/pipeline-workspace.js`, but the VCS layer defines `ExecGit` in `vcs/git-ops.ts` (and other tasks import it from there). This will be confusing at best and may fail type-checking.
- **Relies on non-spec `baseBranch` state:** implementation uses `state.baseBranch ?? "main"` and tests set `baseBranch: "main"`.
- **Integration target (AC18) is correct** (hooks.ts `onAgentEnd`), but needs alignment on inputs: per spec, done action should call `squashAndPush(execGit, branchName, baseBranch, commitMessage)` — you need a spec-aligned way to choose `baseBranch` without introducing undocumented state fields.

### Missing Coverage / Spec Mismatches
No acceptance criteria appear completely unaddressed, but several are **implemented in a way that doesn’t match the spec text**:
- **AC8:** `ensureBranch` return type/shape (baseBranch leakage)
- **AC13:** state change should add `branchName` (plan adds extra state and depends on it)
- **AC14–AC15:** branch ops should be triggered in the **`ui.ts` issue activation** flow (plan does `commands.ts`)

### Ordering & Dependencies
Dependencies are generally sensible, but Tasks 12–14 currently depend on the `baseBranch` additions introduced by Tasks 6 and 10; once you remove/adjust `baseBranch`, re-check those dependency chains.

### TDD Completeness / Conventions
- Commands use `bun test ...` and test file locations (`tests/*.test.ts`) match project conventions.
- Most tasks provide concrete failing expectations.

### Verdict
**revise** — primary fixes needed are spec-alignment around `ensureBranch` return shape, removing/justifying `baseBranch`, and wiring AC14/AC15 in the correct module (`ui.ts`) per the acceptance criteria.

