---
id: 8
title: squashPipelineWorkspace returns discriminated union
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - tests/pipeline-workspace.test.ts
files_to_create: []
---

### Task 8: squashPipelineWorkspace returns discriminated union

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Replace the existing squash tests in `tests/pipeline-workspace.test.ts`:

```typescript
  it("squashPipelineWorkspace returns ok:true on success", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--name-only"))
        return { stdout: "diff --git a/a.ts b/a.ts\n+x", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
  });

  it("squashPipelineWorkspace returns ok:true when there are no changes", async () => {
    const execGit: ExecGit = async (args) => {
      // --name-only returns empty = no changed files
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
  });

  it("squashPipelineWorkspace returns ok:false on failure and preserves worktree", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--name-only"))
        return { stdout: "diff content", stderr: "" };
      if (args[0] === "apply") throw new Error("git apply failed");
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("apply");
    }
    // No worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — Property 'ok' does not exist on type '{ error?: string }'

**Step 3 — Write minimal implementation**

Update `squashPipelineWorkspace` in `extensions/megapowers/subagent/pipeline-workspace.ts` to return discriminated union. Keep the existing `git apply` logic for now (Task 9 replaces it with file-copy):

```typescript
export type SquashWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function squashPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<SquashWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const diff = await execGit(inDir(workspacePath, ["diff", "--cached", "HEAD"]));

    if (!diff.stdout.trim()) {
      try {
        await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
      } catch {
        // ignore cleanup failure
      }
      return { ok: true };
    }

    const patchPath = join(tmpdir(), `mega-squash-${pipelineId}.patch`);
    writeFileSync(patchPath, diff.stdout);
    await execGit(["apply", "--allow-empty", patchPath]);

    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git squash failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — existing callers use `(squash as any).error` which still returns `undefined` on success (ok:true has no error field) and the error string on failure.
