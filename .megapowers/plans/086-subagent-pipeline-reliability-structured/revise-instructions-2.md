# Revision Instructions (Iteration 2)

Only the tasks listed below need changes. For all other tasks, keep them as-is.

## Task 7: createPipelineWorkspace temp-commit and reset behavior

### Problem 1 — Main working directory can be mutated on failure
In the proposed Step 3 implementation, if `git add -A` succeeds but the `git commit ...` step fails, the function returns `{ ok: false }` **without undoing the staging**. That violates AC1 (“main WD is unchanged”) in the common failure case where commit fails (e.g. hooks, permissions, repo state).

### Fix
Track whether `git add -A` ran, and on *any* failure before the temp commit is created, unstage before returning.

Add a third unit test that forces the commit to throw and asserts a reset/unstage call happened:

```ts
it("unstages changes if commit fails after add -A", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args.includes("commit")) throw new Error("commit failed");
    return { stdout: "", stderr: "" };
  };

  const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
  expect(r.ok).toBe(false);

  // ensure we attempted to undo staging so main WD is not left in a different state
  expect(
    calls.some((a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && !a.includes("HEAD~1")),
  ).toBe(true);
});
```

Then update `createPipelineWorkspace()` so that:
- it records `stagedAll = true` after `add -A` succeeds
- if commit fails (i.e. `tempCommitted === false`) and `stagedAll === true`, it runs **one** of:
  - `git -C <projectRoot> reset` (mixed reset to unstage) OR
  - `git -C <projectRoot> reset --mixed` (same)

Example patch (shape only):

```ts
let stagedAll = false;
let tempCommitted = false;

try {
  await execGit(inDir(projectRoot, ["add", "-A"]));
  stagedAll = true;

  await execGit(inDir(projectRoot, [/* -c identity..., */ "commit", /* ... */]));
  tempCommitted = true;

  await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
} catch (err) {
  worktreeError = err instanceof Error ? err.message : String(err);
} finally {
  // If we staged but never successfully created the temp commit, undo staging.
  if (stagedAll && !tempCommitted) {
    try { await execGit(inDir(projectRoot, ["reset"])); } catch {}
  }
}
```

Keep the existing AC5 behavior: if the temp commit succeeded, always do `git reset HEAD~1` even when `worktree add` fails.

## Task 9: squashPipelineWorkspace uses file-copy instead of git apply

### Problem — Rename/copy entries are not correctly mirrored
The plan uses `--diff-filter=AMCR`, but the proposed implementation uses `--name-only`, which does **not** provide the old path for renames (`R`) and copies (`C`). That can leave the *old* path behind in the main working directory when a rename happens (end state differs from worktree).

### Fix (minimal while still satisfying AC6/AC7)
Keep the required commands for AC6/AC7:
- `git diff --cached --name-only --diff-filter=AMCR`
- `git diff --cached --name-only --diff-filter=D`

…but add one extra command to handle rename old-path cleanup:
- `git diff --cached --name-status --diff-filter=R`

Parse lines like `R100\told/path.ts\tnew/path.ts` and delete `old/path.ts` from the project root (in addition to copying `new/path.ts`).

Add a unit test that simulates a rename by having execGit return:
- AMCR name-only: `new/path.ts\n`
- R name-status: `R100\told/path.ts\tnew/path.ts\n`
- D name-only: ``

and assert that after squash:
- `new/path.ts` exists / is copied
- `old/path.ts` is removed

(You can create both files under `projectRoot` and `wsPath` like the other Task 9 tests.)

## Task 14: Refactor runPipeline (shell verify, bounded context, structured result)

### Problem 1 — verify step infrastructure errors aren’t handled
`runVerifyStep()`/`execShell` can throw (spawn failure, bad cwd, etc.). The current plan calls `runVerifyStep(...)` without a try/catch, so the whole pipeline can crash instead of returning a paused `PipelineResult` with `infrastructureError` (AC26).

### Fix
Wrap verify in a try/catch and treat exceptions as **infrastructure** failures:
- `PipelineResult.status = "paused"` when retry budget is exhausted
- populate `infrastructureError` and `errorSummary`
- on retry (when budget remains), call `withRetryContext(ctx, { reason: "verify_failed", detail: <error message + any output> })` (bounded; replaces previous retry data)

Add a test that forces `execShell` to throw:

```ts
it("verify infrastructure failure populates infrastructureError", async () => {
  const dispatcher: Dispatcher = { async dispatch() { return mkDispatch(0, { messages: [] as any }); } };
  const throwingShell: ExecShell = async () => { throw new Error("spawn ENOENT"); };

  const r = await runPipeline(
    { taskDescription: "x" },
    dispatcher,
    { projectRoot, workspaceCwd: join(projectRoot, "ws"), pipelineId: "p", agents: { implementer: "implementer", reviewer: "reviewer" }, execGit: async () => ({ stdout: "", stderr: "" }), execShell: throwingShell, maxRetries: 0 },
  );

  expect(r.status).toBe("paused");
  expect(r.infrastructureError).toContain("ENOENT");
  expect(r.testsPassed).toBeUndefined();
});
```

### Problem 2 — review rejection pause result loses the rejection details
When retry budget is exhausted after a `reject` verdict, the returned `PipelineResult` should still include `reviewVerdict` and `reviewFindings` so the caller/UI can show *why* it paused.

### Fix
In the `cycle >= maxRetries` branch for review rejection, include:
- `reviewVerdict: "reject"`
- `reviewFindings: verdict.findings`

(and keep `errorSummary`)

## Task 15: Remove deprecated context API stubs [no-test]

### Problem — Task references code that doesn’t exist and would break existing tests
`extensions/megapowers/subagent/pipeline-context.ts` currently *is* the legacy accumulating context implementation and is still covered by `tests/pipeline-context.test.ts` (it imports `appendStepOutput` and `setRetryContext`).

The task text mentions a `"=== Deprecated API ==="` marker and a `withRetryContext` export that do not exist in the codebase.

### Fix options (pick one)
**Option A (recommended):** Remove Task 15 from the plan entirely. Task 13+14 already satisfy AC22–AC24 by moving the runner to `pipeline-context-bounded.ts`.

**Option B:** If you want cleanup, rewrite Task 15 to be a *purely additive* documentation change (e.g., add a comment at the top of `pipeline-context.ts` saying it’s legacy/unbounded). Do **not** delete `appendStepOutput`/`setRetryContext` unless you also update `tests/pipeline-context.test.ts` accordingly.
