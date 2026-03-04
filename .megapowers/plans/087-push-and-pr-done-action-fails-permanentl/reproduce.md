# Reproduction: push-and-pr done action permanently blocks close-issue when on main after PR merge

## Steps to Reproduce

1. Complete the code-review phase; system transitions to `done`
2. The `doneActions` checklist includes `["push-and-pr", "close-issue"]` (or similar sequence)
3. Create and merge the PR on GitHub (via any mechanism)
4. Run `git checkout main && git pull` in the local repo — this checks you out onto `main` and deletes (or leaves absent) the local feature branch (e.g. `feat/001-test`)
5. Start a new pi session (or any subsequent turn triggers `onAgentEnd`)
6. `onAgentEnd` fires with `doneActions[0] === "push-and-pr"`

**Result:** `push-and-pr` fails on every call. It is never consumed. `close-issue` is permanently blocked.

---

## Expected Behavior

The `push-and-pr` action should either:
- Detect that the PR is already merged / local branch is gone and skip/consume the action gracefully, OR
- Successfully complete the push by first checking out the feature branch (if it still exists locally)

After `push-and-pr` is resolved (success or skip), `close-issue` should run, resetting state to idle.

---

## Actual Behavior

Every call to `onAgentEnd` produces:

```
NOTIFY [error]: Push failed (push): error: src refspec feat/001-test does not match any
```

`doneActions` remains `["push-and-pr", "close-issue"]` indefinitely. `close-issue` never executes. The issue is permanently stuck in the `done` phase with a non-null `activeIssue`.

---

## Evidence

### Execution trace (from instrumented unit test)

```
=== Call 1 ===
git reset --soft main          ← no-op: already on main, nothing to reset
git status --porcelain         ← empty: clean working tree
git push origin feat/001-test --force-with-lease  ← FAILS: local branch doesn't exist
NOTIFY [error]: Push failed (push): error: src refspec feat/001-test does not match any
doneActions after call 1: ["push-and-pr","close-issue"]

=== Call 2 ===
git reset --soft main
git status --porcelain
git push origin feat/001-test --force-with-lease
NOTIFY [error]: Push failed (push): error: src refspec feat/001-test does not match any
doneActions after call 2: ["push-and-pr","close-issue"]
```

### Root cause chain

1. **`hooks.ts` line 150**: `squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg)` is called with no prior branch checkout.
2. **`git-ops.ts` `squashOnto`**: `git reset --soft main` is a no-op when HEAD is already at `main`. `git status --porcelain` returns empty. Function returns `{ ok: true, committed: false }` — squash "succeeds".
3. **`git-ops.ts` `pushBranch`**: `git push origin feat/001-test --force-with-lease` fails because `feat/001-test` does not exist as a local ref (branch was deleted after merge or was never created locally on this machine after the merge).
4. **`branch-manager.ts` `squashAndPush`**: Returns `{ ok: false, error: "error: src refspec feat/001-test does not match any", step: "push" }`.
5. **`hooks.ts` lines 151–154**: AC19 retry logic — action is NOT consumed on failure. `return` is called without removing `push-and-pr` from `doneActions`.
6. **Result**: Every subsequent `onAgentEnd` repeats steps 1–5. `close-issue` (at `doneActions[1]`) is never reached because the handler processes only `doneActions[0]` and bails on failure.

### Two structural issues confirmed

| Issue | Description |
|-------|-------------|
| **No branch checkout** | Handler calls `squashAndPush` without verifying/checking out the feature branch first. When on `main`, `squashOnto` silently succeeds (no-op), so execution falls through to `pushBranch` with a non-existent local branch. |
| **Permanent blocking** | A stuck `doneActions[0]` permanently prevents all subsequent actions from executing. There is no skip/consume path for the "branch already merged and gone" case. |

---

## Failing Test

**File:** `tests/hooks.test.ts`  
**Describe block:** `"BUG #087: push-and-pr permanently blocks when on main after PR merge"`  
**Test:** `"push-and-pr stays stuck permanently when local feature branch is deleted (on main after merge)"`

```typescript
it("push-and-pr stays stuck permanently when local feature branch is deleted (on main after merge)", async () => {
  // Simulate: user is on main after merging PR; local feature branch was deleted.
  // git reset --soft main  → no-op (already at main, clean tree)
  // git status --porcelain → empty (nothing staged)
  // git push origin feat/001-test --force-with-lease → FAILS (local branch doesn't exist)
  const execGit: ExecGit = async (args) => {
    if (args[0] === "reset") return { stdout: "", stderr: "" }; // no-op on main
    if (args[0] === "status") return { stdout: "", stderr: "" }; // clean tree
    if (args[0] === "push") throw new Error("error: src refspec feat/001-test does not match any");
    return { stdout: "", stderr: "" };
  };

  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "done",
    branchName: "feat/001-test",
    baseBranch: "main",
    doneActions: ["push-and-pr", "close-issue"],
    doneChecklistShown: true,
  });

  // ... [3 calls to onAgentEnd] ...

  // BUG: push-and-pr is never consumed — permanently stuck
  expect(readState(tmp).doneActions).not.toContain("push-and-pr"); // FAILS
  // BUG: close-issue never runs
  expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]); // FAILS
  expect(readState(tmp).activeIssue).toBeNull(); // FAILS
});
```

**Test result:**
```
error: expect(received).not.toContain(expected)
Expected to not contain: "push-and-pr"
Received: [ "push-and-pr", "close-issue" ]
```

**Test is reproducible:** Yes — fails 100% of the time with current code.

---

## Environment

- **Bun:** 1.3.9
- **Node:** v25.6.1
- **Git:** 2.53.0
- **OS:** macOS 26.3 (arm64)
- **Relevant files:**
  - `extensions/megapowers/hooks.ts` lines 129–178 (push-and-pr handler)
  - `extensions/megapowers/vcs/branch-manager.ts` `squashAndPush`
  - `extensions/megapowers/vcs/git-ops.ts` `squashOnto`, `pushBranch`

---

## Reproducibility

**Always** — triggered deterministically whenever:
1. `state.doneActions[0] === "push-and-pr"` AND
2. The current git HEAD is on the base branch (e.g. `main`) AND
3. The local feature branch (`state.branchName`) does not exist as a local ref

This condition arises naturally after: transition to done → PR merged on GitHub → `git checkout main && git pull`.
