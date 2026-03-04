# Revise Instructions (Iteration 3)

## Task 9: squashPipelineWorkspace uses file-copy instead of git apply

**Step 1 — First test is broken: missing file in worktree.** The "squash copies changed files from worktree to project root" test mocks `execGit` to return `src/new.ts` in the AMCR diff output, but never creates `src/new.ts` in the worktree directory (`wsPath`). When `copyFileSync(join(wsPath, "src", "new.ts"), ...)` runs, it will throw `ENOENT` because the file doesn't exist.

Fix: Add `writeFileSync(join(wsPath, "src", "new.ts"), "export const x = 1;");` right after the `mkdirSync(join(wsPath, "src"), ...)` line:

```typescript
  it("squash copies changed files from worktree to project root (file-copy, not git apply)", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-copy-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(join(wsPath, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(join(wsPath, "src", "new.ts"), "export const x = 1;");       // <-- ADD THIS
    writeFileSync(join(wsPath, "src", "modified.ts"), "updated content");
    writeFileSync(join(projectRoot, "src", "modified.ts"), "old content");
    // ... rest unchanged
```

## Task 14: Refactor runPipeline

**Step 5 regression issue:** After Task 14 rewrites `pipeline-runner.ts` (removing `verifier` from `PipelineAgents`, making verify a shell command), the existing tests in `tests/pipeline-tool.test.ts` will break because:

1. They pass `agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" }` — but `PipelineAgents` no longer has `verifier`.
2. They mock a `verifier` agent dispatch that never gets called.
3. They don't provide `execShell`, so the runner falls back to `defaultExecShell` which actually runs `bun test` in the temp directory (fails with no test files).

Task 16 fixes these tests, but Task 14 Step 5 claims `bun test` should pass. Either:

**Option A (recommended):** Move the `pipeline-tool.ts` test updates from Task 16 into Task 14. Task 14 already modifies `pipeline-tool.ts` (removing verifier from agents line). It should also update the tests that depend on the removed `verifier` agent and the new shell-based verify.

**Option B:** Change Task 14 Step 5 to say "Run: `bun test tests/pipeline-runner.test.ts` / Expected: PASS" (only the runner tests), and note that `tests/pipeline-tool.test.ts` will be fixed in Task 16. But this breaks the convention that Step 5 runs the full suite.

I recommend Option A: merge Task 16's content into Task 14 (add `execShell` parameter to `handlePipelineTool` and update the pipeline-tool tests) as part of Task 14's implementation. Then remove Task 16 or convert it to a no-op.

Alternatively, keep them separate but **add the minimal `pipeline-tool.test.ts` fixes to Task 14** to keep the full suite passing: update the `agents` lines (remove `verifier`), add a passthrough `execShell` with a default passing mock, and update reviewer mocks to return frontmatter. Then Task 16 can focus only on its specific new test ("pipeline dispatches exactly 2 agents").

## Task 15: Add legacy deprecation comment to pipeline-context.ts

No code issues, but it's marked `needs_revision` in the frontmatter despite being fine. Update its status to `approved` (or leave as-is if the status is managed elsewhere).
