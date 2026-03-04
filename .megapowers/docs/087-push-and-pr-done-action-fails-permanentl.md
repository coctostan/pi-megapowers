# Bugfix Summary: push-and-pr Done Action Permanently Stuck After PR Merge

**Issue:** #087  
**Type:** Bugfix  
**Files Changed:** `extensions/megapowers/hooks.ts`, `tests/hooks.test.ts`

---

## Root Cause

The `push-and-pr` done-action handler in `hooks.ts` called `squashAndPush()` without first verifying that the local feature branch still existed. After the typical post-merge cleanup workflow (`git checkout main && git pull && git branch -d feat/001-xxx`), the user is on `main` with the local feature branch deleted.

When `onAgentEnd` ran in this state:

1. `squashOnto("main", ...)` issued `git reset --soft main` — a no-op since HEAD was already at `main`. The tree was clean, so it returned `{ ok: true, committed: false }` (correct behavior, but silently proceeds).
2. `pushBranch("feat/001-xxx", true)` issued `git push origin feat/001-xxx --force-with-lease` — **permanently failed** with `error: src refspec feat/001-xxx does not match any` because the local branch didn't exist.
3. The AC19 "don't consume on failure" guard left `push-and-pr` at `doneActions[0]`, blocking `close-issue` at index 1 forever.

The `doneActions` queue processes only `doneActions[0]` per turn, so a permanent failure at index 0 blocks all subsequent actions indefinitely. State never reset, `activeIssue` stayed non-null.

**Secondary root cause:** AC19 (retry on push failure) was designed for transient failures (network, auth). It made no distinction between transient and permanent failures (local branch deleted — can never recover without manual intervention).

---

## Fix Approach

Added a `git rev-parse --verify <branchName>` pre-check immediately before `squashAndPush`, following the same consume-and-notify pattern already present for `execGit unavailable` and `baseBranch missing` conditions:

```typescript
// Check whether the local feature branch still exists.
// If it was deleted after merging (e.g. git branch -d feat/...), the push
// would permanently fail with "src refspec does not match any". Skip and
// consume the action so close-issue can run (FC1, FC3 — BUG #087).
try {
  await deps.execGit(["rev-parse", "--verify", state.branchName]);
} catch {
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
  if (ctx.hasUI) ctx.ui.notify("Feature branch not found locally — push skipped. PR may already be merged.", "info");
  return;
}
```

This detects the permanent failure condition **before** attempting the push, consumes the action, and allows `close-issue` to run on the next turn.

The `rev-parse --verify` pattern was already established in `branch-manager.ts` (`ensureBranch`); it was simply missing in the `push-and-pr` handler.

---

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/hooks.ts` | +12 lines: `rev-parse --verify` pre-check inside `push-and-pr` handler |
| `tests/hooks.test.ts` | +93 lines: regression test (`BUG #087` describe block) with two tests |

No changes to `branch-manager.ts`, `git-ops.ts`, or any state machine code.

---

## How to Verify the Fix

### Run the regression test

```bash
bun test tests/hooks.test.ts --test-name-pattern "push-and-pr stays stuck permanently"
```

Expected: `1 pass, 0 fail`

### Run the full test suite

```bash
bun test
```

Expected: `825 pass, 0 fail`

### Manually reproduce the scenario

1. Be on `main` with a clean working tree and no local feature branch.
2. Have `doneActions: ["push-and-pr", "close-issue"]` in state.
3. Trigger `onAgentEnd`.
4. **Before fix:** `push-and-pr` stays stuck forever; `close-issue` never runs.
5. **After fix:** `push-and-pr` is consumed with an info notification; `close-issue` runs on the next turn and resets state to idle.

---

## AC19 Preservation

The fix does not change AC19 behavior for transient push failures (network, auth, remote rejection). The `rev-parse --verify` check only fires if the local branch is absent. If the branch exists and the push fails for any other reason, AC19 still applies and the action is not consumed.
