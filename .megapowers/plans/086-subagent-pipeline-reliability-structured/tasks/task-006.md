---
id: 6
title: createPipelineWorkspace returns discriminated union
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - tests/pipeline-workspace.test.ts
files_to_create: []
---

### Task 6: createPipelineWorkspace returns discriminated union

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Replace the existing `createPipelineWorkspace` tests in `tests/pipeline-workspace.test.ts` with discriminated union assertions:

```typescript
// In tests/pipeline-workspace.test.ts, replace the "AC14: createPipelineWorkspace" test with:

  it("createPipelineWorkspace returns ok:true with workspaceName and workspacePath on success", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.workspacePath).toBe("/project/.megapowers/workspaces/pipe-1");
      expect(r.workspaceName).toBe("mega-pipe-1");
    }
  });

  it("createPipelineWorkspace returns ok:false with error on failure", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("add")) {
        throw new Error("fatal: worktree add failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("worktree add failed");
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — Property 'ok' does not exist on type '{ workspaceName: string; workspacePath: string; error?: string }'

**Step 3 — Write minimal implementation**

Replace the `createPipelineWorkspace` function in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export type CreateWorkspaceResult =
  | { ok: true; workspaceName: string; workspacePath: string }
  | { ok: false; error: string };

export async function createPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CreateWorkspaceResult> {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });
  } catch {
    // best effort; execGit surfaces actionable errors
  }

  try {
    await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
    return { ok: true, workspaceName, workspacePath };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git worktree add failed" };
  }
}
```

Also update the existing test that checks `(r as any).error` in the "subagent workspace creation fails on fresh repo" section of `tests/reproduce-086-bugs.test.ts` — that test uses `(r as any).error` but will keep working since `ok: false` results still have `error`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — existing tests that use `(r as any).error` still work because the `error` field is still present on failure results. The `reproduce-086-bugs.test.ts` test uses `(r as any).error` which will be `undefined` on success results (correct).
