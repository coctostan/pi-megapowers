# Diagnosis

## Root Cause

**Primary root cause:** The `push-and-pr` done-action handler in `hooks.ts` calls `squashAndPush()` without first verifying that the local feature branch exists. When the user is on `main` with the feature branch deleted (post-merge cleanup: `git checkout main && git pull && git branch -d feat/001-test`), `squashOnto` silently succeeds as a no-op, then `pushBranch` permanently fails because there is no local ref to push.

**Secondary root cause:** The AC19 "don't consume on failure" retry logic makes no distinction between transient failures (network, auth — correctly retried) and permanent failures (local branch deleted — can never recover). There is no skip path for the "branch no longer exists" case. Every `onAgentEnd` call thereafter hits the same permanent failure, and `close-issue` (which sits behind `push-and-pr` in the queue) is blocked indefinitely.

---

## Trace

### Symptom (starting point)
```
NOTIFY [error]: Push failed (push): error: src refspec feat/001-test does not match any
doneActions stays: ["push-and-pr", "close-issue"]   ← forever
```

### Step 1 — `hooks.ts:150` calls `squashAndPush`
```typescript
// hooks.ts line 150
const pushResult = await squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg);
```
`state.branchName` = `"feat/001-test"`, `baseBranch` = `"main"`. No checkout is performed first. The handler assumes it is on the feature branch — but it is on `main`.

### Step 2 — `branch-manager.ts:65` calls `squashOnto`
```typescript
const squashResult = await squashOnto(execGit, baseBranch, commitMessage);
```

### Step 3 — `git-ops.ts:74`: `git reset --soft main` is a no-op
When HEAD is already on `main`, soft-resetting to `main` does nothing. The working tree is clean (no uncommitted changes). `git status --porcelain` returns empty string.

```typescript
// git-ops.ts lines 74-78
await execGit(["reset", "--soft", baseBranch]);   // no-op
const status = await execGit(["status", "--porcelain"]);
if (!status.stdout.trim()) {
  return { ok: true, committed: false };           // ← silently returns success
}
```

`squashOnto` returns `{ ok: true, committed: false }`. This is not an error — it is the designed behavior for "nothing to squash." The problem is that this is the wrong result for this situation.

### Step 4 — `branch-manager.ts:70`: `pushBranch` called with deleted branch
```typescript
const pushResult = await pushBranch(execGit, branchName, true);
// → git push origin feat/001-test --force-with-lease
```
`feat/001-test` no longer exists as a local ref. Git cannot resolve the source refspec and throws:
```
error: src refspec feat/001-test does not match any
```
`pushBranch` catches this and returns `{ ok: false, error: "error: src refspec feat/001-test does not match any" }`.

`squashAndPush` propagates: `{ ok: false, error: "...", step: "push" }`.

### Step 5 — `hooks.ts:151–154`: AC19 blocks consumption
```typescript
if (!pushResult.ok) {
  // AC19: don't consume action on failure — user can retry
  if (ctx.hasUI) ctx.ui.notify(`Push failed (${pushResult.step}): ${pushResult.error}`, "error");
  return;   // ← returns WITHOUT consuming "push-and-pr"
}
```
`push-and-pr` remains at `doneActions[0]`. Next call to `onAgentEnd` starts at Step 1 again. The loop is infinite.

### Step 6 — `close-issue` is permanently blocked
`doneActions` is processed sequentially — only `doneActions[0]` is touched per `onAgentEnd` call (line 111: `const doneAction = state.doneActions[0]`). With `push-and-pr` stuck at index 0, `close-issue` at index 1 is never reached. State is never reset. `activeIssue` stays non-null forever.

---

## Affected Code

| File | Lines | Role |
|------|-------|------|
| `extensions/megapowers/hooks.ts` | 129–155 | `push-and-pr` handler — missing local-branch existence check before calling `squashAndPush` |
| `extensions/megapowers/vcs/branch-manager.ts` | 59–76 | `squashAndPush` — assumes caller is on feature branch; does not verify branch existence |
| `extensions/megapowers/vcs/git-ops.ts` | 68–84 | `squashOnto` — returns `{ ok: true, committed: false }` when there is nothing to squash (correct behavior, but silently allows execution to proceed to `pushBranch` with an invalid local ref) |

---

## Pattern Analysis

### What working graceful-skip paths look like (same function, lines 131–143)

The handler has two existing graceful-skip patterns — both detect permanent failure conditions **before** attempting the operation, then **consume the action**:

```typescript
// Pattern: detect condition → consume action → notify → return
if (!deps.execGit || !state.branchName) {
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
  if (ctx.hasUI) ctx.ui.notify("VCS: No branch tracked — skipping push & PR.", "info");
  return;
}

if (!state.baseBranch) {
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
  if (ctx.hasUI) ctx.ui.notify("VCS: baseBranch is missing — skipping push & PR.", "error");
  return;
}
```

### What's broken (lines 129–155)

There is NO such check for "local feature branch does not exist." The handler goes straight to `squashAndPush` after confirming `branchName` is non-null in state — but non-null in state does not mean the branch still exists in the repo.

| Condition checked | Handled? |
|---|---|
| `execGit` unavailable | ✅ skip/consume |
| `branchName` null in state | ✅ skip/consume |
| `baseBranch` null in state | ✅ skip/consume |
| **local branch deleted from repo** | ❌ **missing** |

### The precedent: `ensureBranch` checks for local branch existence first

`extensions/megapowers/vcs/branch-manager.ts` lines 28–39:
```typescript
try {
  await execGit(["rev-parse", "--verify", branchName]);
  // Branch exists — check it out
  ...
} catch {
  // Branch doesn't exist — create it
  ...
}
```

The pattern for detecting a missing local branch is already established and used elsewhere. It is simply missing in the `push-and-pr` handler.

### AC19 assumption is violated

AC19 ("don't consume on failure") is designed for transient failures (network, authentication). The push failure here is structural/permanent — no amount of retrying will create the local branch. AC19 was written without considering permanent push failures.

---

## Risk Assessment

### What could break if this is changed

1. **Legitimate retry scenario**: If a push fails for a transient reason (e.g., auth error) while the user is also on main with the feature branch deleted, the new check would skip/consume when it should retry. However, this case is extremely unlikely — if auth fails you'd see it before the branch is deleted.

2. **`squashAndPush` not exported from hooks**: The fix is in `hooks.ts`, not `squashAndPush` itself. `squashAndPush` has no behavior change — only `hooks.ts` adds a pre-check. No other callers of `squashAndPush` are affected.

3. **Sequential `doneActions` processing**: The fix unblocks `close-issue` for this specific scenario, but the underlying sequential architecture (one action per turn, first action blocks all others on failure) remains. Other stuck-action scenarios could still arise for different reasons. This is a separate structural concern.

### Blast radius: minimal
- Only `hooks.ts` `onAgentEnd` handler for `push-and-pr` is modified
- No changes to `squashAndPush`, `squashOnto`, `pushBranch`, or their tests
- No state machine changes
- No new state fields

### Related latent bugs
- Any done action that fails permanently (not just `push-and-pr`) would exhibit the same blocking behavior. The sequential architecture is a broader systemic risk, but addressing it is outside the scope of this specific bug.

---

## Fixed When

1. When the local feature branch does not exist as a git ref, `onAgentEnd` skips and **consumes** the `push-and-pr` action (does not leave it in `doneActions`).
2. After `push-and-pr` is consumed (skipped), `close-issue` executes on the next `onAgentEnd` call, resetting state to idle.
3. The user sees an informational notification explaining the skip (e.g., "Feature branch not found locally — push skipped. PR may already be merged.").
4. The existing AC19 retry behavior is preserved for all other push failure cases (network, auth, remote rejection).
5. The regression test in `tests/hooks.test.ts` ("BUG #087: push-and-pr permanently blocks when on main after PR merge") passes.
