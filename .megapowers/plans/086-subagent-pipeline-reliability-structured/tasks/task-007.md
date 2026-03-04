---
id: 7
title: createPipelineWorkspace temp-commit and reset behavior
status: approved
depends_on:
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - tests/pipeline-workspace.test.ts
files_to_create: []
---

### Task 7: createPipelineWorkspace temp-commit and reset behavior [depends: 6]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

Add these imports at the top of `tests/pipeline-workspace.test.ts` (extending the existing `readFileSync` import):

```typescript
import { readFileSync, mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
```

Add these tests inside the `describe("pipeline-workspace")` block:

```typescript
  it("temp-commits with identity config before worktree add, then resets", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);

    const addIdx = calls.findIndex(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("add") && a.includes("-A"),
    );
    const commitIdx = calls.findIndex(
      (a) =>
        a.includes("-C") &&
        a.includes("/project") &&
        a.includes("commit") &&
        a.includes("user.name=megapowers") &&
        a.includes("user.email=megapowers@local") &&
        a.includes("--no-gpg-sign"),
    );
    const worktreeIdx = calls.findIndex(
      (a) => a.includes("worktree") && a.includes("add"),
    );
    const resetIdx = calls.findIndex(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && a.includes("HEAD~1"),
    );

    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(commitIdx).toBeGreaterThan(addIdx);
    expect(worktreeIdx).toBeGreaterThan(commitIdx);
    expect(resetIdx).toBeGreaterThan(worktreeIdx);
  });

  it("resets temp commit even when worktree creation fails", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("worktree") && args.includes("add")) {
        throw new Error("worktree add failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    const resetCall = calls.find(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && a.includes("HEAD~1"),
    );
    expect(resetCall).toBeDefined();
  });

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

  it("integration: worktree contains uncommitted additions from main WD (AC2)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ws-integ-"));
    try {
      execSync("git init", { cwd: tmp, stdio: "pipe" });
      execSync('git -c user.name=test -c user.email=test@test commit --allow-empty -m "init"', {
        cwd: tmp,
        stdio: "pipe",
      });

      // Create uncommitted file (the core bug case)
      writeFileSync(join(tmp, "new-file.ts"), "export const x = 1;");

      const realExecGit: ExecGit = async (args) => {
        const result = execSync(`git ${args.join(" ")}`, { stdio: "pipe", encoding: "utf-8" });
        return { stdout: String(result), stderr: "" };
      };

      const r = await createPipelineWorkspace(tmp, "integ-1", realExecGit);
      expect(r.ok).toBe(true);
      if (r.ok) {
        // AC2: The new file should exist in the worktree
        expect(existsSync(join(r.workspacePath, "new-file.ts"))).toBe(true);
        expect(readFileSync(join(r.workspacePath, "new-file.ts"), "utf-8")).toBe("export const x = 1;");
      }

      // AC1: Main WD should be unchanged (reset happened)
      expect(existsSync(join(tmp, "new-file.ts"))).toBe(true);
    } finally {
      try {
        execSync(
          `git -C "${tmp}" worktree remove --force "${join(tmp, ".megapowers", "workspaces", "integ-1")}"`,
          { stdio: "pipe" },
        );
      } catch {}
      rmSync(tmp, { recursive: true, force: true });
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — `expect(received).toBeGreaterThanOrEqual(expected)` — Expected >= 0, Received -1 (no `add -A` call in current implementation; Task 6's `createPipelineWorkspace` only does `worktree add`). The integration test also fails: `expect(received).toBe(expected)` — Expected true, Received false (worktree doesn't contain uncommitted file because no temp commit was made).

**Step 3 — Write minimal implementation**

Replace the `createPipelineWorkspace` function in `extensions/megapowers/subagent/pipeline-workspace.ts`:

```typescript
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
    // best effort
  }
  // AC1/AC2: Temp-commit all uncommitted changes (including untracked) with injected identity
  let stagedAll = false;
  let tempCommitted = false;
  let worktreeError: string | undefined;
  try {
    await execGit(inDir(projectRoot, ["add", "-A"]));
    stagedAll = true;
    await execGit(
      inDir(projectRoot, [
        "-c",
        "user.name=megapowers",
        "-c",
        "user.email=megapowers@local",
        "commit",
        "--allow-empty",
        "--no-gpg-sign",
        "-m",
        "temp-pipeline-commit",
      ]),
    );
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
  // AC1/AC5: always reset if temp commit succeeded, even on worktree failure
  if (tempCommitted) {
    try {
      await execGit(inDir(projectRoot, ["reset", "HEAD~1"]));
    } catch (resetErr) {
      const resetMsg = resetErr instanceof Error ? resetErr.message : String(resetErr);
      const combined = worktreeError
        ? `${worktreeError}; reset failed: ${resetMsg}`
        : `Worktree created but reset failed: ${resetMsg}`;
      return { ok: false, error: combined };
    }
  }
  if (worktreeError) {
    return { ok: false, error: worktreeError };
  }
  return { ok: true, workspaceName, workspacePath };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
