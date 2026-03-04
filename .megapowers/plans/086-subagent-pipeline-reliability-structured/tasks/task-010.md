---
id: 10
title: cleanupPipelineWorkspace returns discriminated union
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - tests/pipeline-workspace.test.ts
files_to_create: []
---

### Task 10: cleanupPipelineWorkspace returns discriminated union

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Replace the existing cleanup test in `tests/pipeline-workspace.test.ts`:

```typescript
  it("cleanupPipelineWorkspace returns ok:true on success", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(calls).toContainEqual([
      "-C", "/project", "worktree", "remove", "--force",
      "/project/.megapowers/workspaces/pipe-1",
    ]);
  });

  it("cleanupPipelineWorkspace returns ok:false with error on failure", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("remove")) {
        throw new Error("worktree remove failed: not a valid directory");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("worktree remove failed");
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — Property 'ok' does not exist on type '{ error?: string }'

**Step 3 — Write minimal implementation**

Update `cleanupPipelineWorkspace` in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export type CleanupWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function cleanupPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CleanupWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git worktree remove failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
