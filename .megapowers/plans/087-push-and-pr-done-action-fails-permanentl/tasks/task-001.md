---
id: 1
title: Add local-branch existence pre-check to push-and-pr handler
status: approved
depends_on: []
no_test: false
files_to_modify:
  - tests/hooks.test.ts
  - extensions/megapowers/hooks.ts
files_to_create: []
---

### Task 1: Add local-branch existence pre-check to push-and-pr handler

**Files:**
- Modify: `tests/hooks.test.ts`
- Modify: `extensions/megapowers/hooks.ts`

**Step 1 — Write the failing test**

The regression test for BUG #087 already exists in `tests/hooks.test.ts` in the describe block `"BUG #087: push-and-pr permanently blocks when on main after PR merge"` (lines ~571–624). The `execGit` mock needs one addition: `rev-parse --verify` must throw to simulate a missing local branch. Update the mock inside that test from:

```typescript
const execGit: ExecGit = async (args) => {
  if (args[0] === "reset") return { stdout: "", stderr: "" }; // no-op on main
  if (args[0] === "status") return { stdout: "", stderr: "" }; // clean tree
  if (args[0] === "push") throw new Error("error: src refspec feat/001-test does not match any");
  return { stdout: "", stderr: "" };
};
```

to:

```typescript
const execGit: ExecGit = async (args) => {
  if (args[0] === "rev-parse" && args[1] === "--verify")
    throw new Error("fatal: Needed a single revision");
  if (args[0] === "reset") return { stdout: "", stderr: "" }; // no-op on main
  if (args[0] === "status") return { stdout: "", stderr: "" }; // clean tree
  if (args[0] === "push") throw new Error("error: src refspec feat/001-test does not match any");
  return { stdout: "", stderr: "" };
};
```

The three assertions at the end of that test remain unchanged:

```typescript
expect(readState(tmp).doneActions).not.toContain("push-and-pr");
expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
expect(readState(tmp).activeIssue).toBeNull();
```

**Step 2 — Run test, verify it fails**

```
bun test tests/hooks.test.ts --reporter=verbose 2>&1 | grep -A 10 "BUG #087"
```

Expected: FAIL — `expect(received).not.toContain(expected) — Expected to not contain: "push-and-pr" Received: [ "push-and-pr", "close-issue" ]`

(The current implementation never calls `rev-parse --verify`, so the mock change has no effect yet. The push still fails, AC19 still blocks consumption.)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/hooks.ts`, insert a `rev-parse --verify` pre-check immediately after the `baseBranch` guard (around line 143) and before the `squashAndPush` call. The new block follows the same consume-and-notify pattern as the existing graceful-skip paths:

```typescript
      // Check whether the local feature branch still exists.
      // If it was deleted after merging (e.g. git branch -d feat/...), the push
      // would permanently fail with "src refspec does not match any". Skip and
      // consume the action so close-issue can run (FC1, FC3 — BUG #087).
      try {
        await deps.execGit(["rev-parse", "--verify", state.branchName]);
      } catch {
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("Feature branch not found locally — push skipped. PR may already be merged.", "info");
        return;
      }
```

Place it between the `baseBranch` guard's closing brace and the `const baseBranch = state.baseBranch;` line. The full relevant region of `hooks.ts` after the edit looks like:

```typescript
    if (!state.baseBranch) {
      // base branch unknown — can't safely squash. Degrade gracefully by consuming the action.
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
      if (ctx.hasUI) ctx.ui.notify("VCS: baseBranch is missing — skipping push & PR.", "error");
      return;
    }

    // Check whether the local feature branch still exists.
    // If it was deleted after merging (e.g. git branch -d feat/...), the push
    // would permanently fail with "src refspec does not match any". Skip and
    // consume the action so close-issue can run (FC1, FC3 — BUG #087).
    try {
      await deps.execGit(["rev-parse", "--verify", state.branchName]);
    } catch {
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      if (ctx.hasUI) ctx.ui.notify("Feature branch not found locally — push skipped. PR may already be merged.", "info");
      return;
    }

    const baseBranch = state.baseBranch;
    const issue = store.getIssue(state.activeIssue);
    const commitPrefix = state.workflow === "bugfix" ? "fix" : "feat";
    const commitMsg = `${commitPrefix}: ${issue?.title ?? state.activeIssue}`;

    const pushResult = await squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg);
    if (!pushResult.ok) {
      // AC19: don't consume action on failure — user can retry
      if (ctx.hasUI) ctx.ui.notify(`Push failed (${pushResult.step}): ${pushResult.error}`, "error");
      return;
    }
```

No changes to `branch-manager.ts`, `git-ops.ts`, or any other file.

**Step 4 — Run test, verify it passes**

```
bun test tests/hooks.test.ts --reporter=verbose 2>&1 | grep -A 10 "BUG #087"
```

Expected: PASS — all three assertions in `"push-and-pr stays stuck permanently..."` succeed:
- `doneActions` does not contain `"push-and-pr"` (consumed after detecting missing branch)
- `statusUpdates` equals `[{ slug: "001-test", status: "done" }]` (close-issue ran on turn 2)
- `activeIssue` is `null` (state reset to idle)

**Step 5 — Verify no regressions**

```
bun test
```

Expected: all passing. Key tests that exercise the changed path and must still pass:
- `"AC18: calls squashAndPush then createPR and removes action on success"` — mock returns success for `rev-parse --verify` (fallthrough), so the new guard is a no-op and existing behavior unchanged.
- `"AC19: does not consume action when squash fails"` — mock returns success for `rev-parse --verify` (fallthrough), squash still fails, AC19 still applies, action still not consumed.
- `"AC20: notifies when PR creation is skipped (no gh)"` — same: `rev-parse --verify` succeeds, push succeeds, AC20 unchanged.
- `"squashOnto is a no-op when already on main (precondition...)"` — unit test on `git-ops.ts` directly; no hooks involved.
