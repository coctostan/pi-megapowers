---
id: 9
title: squashPipelineWorkspace uses file-copy instead of git apply
status: approved
depends_on:
  - 7
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - tests/pipeline-workspace.test.ts
  - tests/oneshot-tool.test.ts
files_to_create: []
---

### Task 9: squashPipelineWorkspace uses file-copy instead of git apply [depends: 7, 8]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Modify: `tests/pipeline-workspace.test.ts`
- Modify: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**

Add `mkdirSync` to the existing `node:fs` import in `tests/pipeline-workspace.test.ts` (which already has `readFileSync, mkdtempSync, writeFileSync, existsSync, rmSync` from Task 7):

```typescript
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
```

Add these tests inside the `describe("pipeline-workspace")` block:

```typescript
  it("squash copies changed files from worktree to project root (file-copy, not git apply)", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-copy-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(join(wsPath, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(join(wsPath, "src", "new.ts"), "export const x = 1;");
    writeFileSync(join(wsPath, "src", "modified.ts"), "updated content");
    writeFileSync(join(projectRoot, "src", "modified.ts"), "old content");
    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "src/new.ts\nsrc/modified.ts\n", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(readFileSync(join(projectRoot, "src", "new.ts"), "utf-8")).toBe("export const x = 1;");
    expect(readFileSync(join(projectRoot, "src", "modified.ts"), "utf-8")).toBe("updated content");
    rmSync(projectRoot, { recursive: true, force: true });
  });
  it("squash deletes files identified by diff-filter=D", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-del-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(wsPath, { recursive: true });

    writeFileSync(join(projectRoot, "old.ts"), "to be removed");

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "old.ts\n", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(existsSync(join(projectRoot, "old.ts"))).toBe(false);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("squash handles renames by copying new path and deleting old path", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-rename-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(wsPath, { recursive: true });

    // old/path.ts exists in project root (the rename source)
    writeFileSync(join(projectRoot, "old", "path.ts"), "old content");
    // new/path.ts exists in worktree (the rename destination)
    mkdirSync(join(wsPath, "new"), { recursive: true });
    writeFileSync(join(wsPath, "new", "path.ts"), "renamed content");
    mkdirSync(join(projectRoot, "old"), { recursive: true });

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "new/path.ts\n", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "R100\told/path.ts\tnew/path.ts\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    // new path was copied
    expect(readFileSync(join(projectRoot, "new", "path.ts"), "utf-8")).toBe("renamed content");
    // old path was removed
    expect(existsSync(join(projectRoot, "old", "path.ts"))).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });
```

Also update the existing failure test (from Task 8) in `tests/pipeline-workspace.test.ts` to trigger failure via the name-only diff instead of `git apply`. Replace the `"squashPipelineWorkspace returns ok:false on failure and preserves worktree"` test with:

```typescript
  it("squashPipelineWorkspace returns ok:false on failure and preserves worktree", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        throw new Error("diff name-only failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("diff name-only failed");
    }
    // No worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });
```

Also update `tests/oneshot-tool.test.ts` — replace the squash failure mock in the `"returns an error when squash fails after successful dispatch"` test to trigger on the name-only diff instead of `git apply`:

```typescript
  it("returns an error when squash fails after successful dispatch", async () => {
    const execGit = async (args: string[]) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        throw new Error("diff name-only failed: squash boom");
      }
      return { stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch() {
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execGit);
    expect(r.error).toContain("Squash failed");
    expect(r.error).toContain("diff name-only failed");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — `readFileSync(join(projectRoot, "src", "new.ts"))` throws `Error: ENOENT: no such file or directory` because the current implementation uses `git apply` (which writes via a patch file), not file-copy. The new file was never copied to the project root.

**Step 3 — Write minimal implementation**

Update the imports at the top of `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
import { join, dirname } from "node:path";
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
```

Remove `writeFileSync` from the `node:fs` import and `tmpdir` from `node:os` (no longer needed — the `patchPath` logic is removed).

Replace `squashPipelineWorkspace` in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
export async function squashPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<SquashWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);
  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const changed = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-only", "--diff-filter=AMCR"]),
    );
    // AC7: Get deleted files
    const deleted = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-only", "--diff-filter=D"]),
    );
    // Get rename entries to clean up old paths
    const renames = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-status", "--diff-filter=R"]),
    );
    const changedFiles = changed.stdout.trim().split("\n").filter(Boolean);
    const deletedFiles = deleted.stdout.trim().split("\n").filter(Boolean);
    // Parse rename lines: "R100\told/path.ts\tnew/path.ts"
    const renameOldPaths: string[] = [];
    for (const line of renames.stdout.trim().split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        renameOldPaths.push(parts[1]);
      }
    }
    // Copy changed files from worktree to main WD
    for (const file of changedFiles) {
      const src = join(workspacePath, file);
      const dest = join(projectRoot, file);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    // Remove deleted files from main WD
    for (const file of deletedFiles) {
      const dest = join(projectRoot, file);
      if (existsSync(dest)) {
        unlinkSync(dest);
      }
    }

    // Remove old paths from renames
    for (const file of renameOldPaths) {
      const dest = join(projectRoot, file);
      if (existsSync(dest)) {
        unlinkSync(dest);
      }
    }
    // Clean up worktree
    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }
    return { ok: true };
  } catch (err: any) {
    // AC9: preserve worktree for inspection on failure
    return { ok: false, error: err?.message ?? "git squash failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — the updated failure mocks in `tests/pipeline-workspace.test.ts` and `tests/oneshot-tool.test.ts` now trigger failure via the name-only diff command instead of `git apply`, which matches the new file-copy implementation.
