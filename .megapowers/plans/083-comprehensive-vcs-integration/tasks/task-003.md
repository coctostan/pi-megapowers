---
id: 3
title: wipCommit in git-ops.ts
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/git-ops.ts
  - tests/git-ops.test.ts
files_to_create: []
---

### Task 3: wipCommit in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { wipCommit, type WipCommitResult } from "../extensions/megapowers/vcs/git-ops.js";

describe("wipCommit", () => {
  it("stages all, checks status, and commits when there are changes (AC4)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await wipCommit(execGit, "WIP: test");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls).toEqual([
      ["add", "-A"],
      ["status", "--porcelain"],
      ["commit", "-m", "WIP: test"],
    ]);
  });

  it("returns committed: false when working tree is clean (AC4)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await wipCommit(execGit, "WIP: test");
    expect(result).toEqual({ ok: true, committed: false });
    // Should not call commit
    expect(calls).toEqual([
      ["add", "-A"],
      ["status", "--porcelain"],
    ]);
  });

  it("returns ok: false when git commit fails (AC23)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "commit") throw new Error("commit failed");
      return { stdout: "", stderr: "" };
    };

    const result = await wipCommit(execGit, "WIP: test");
    expect(result).toEqual({ ok: false, error: "commit failed" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — wipCommit is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
export type WipCommitResult = { ok: true; committed: boolean } | { ok: false; error: string };

/**
 * AC4: Stage all changes, check for uncommitted changes, commit if any.
 * Returns committed: false when working tree is clean.
 */
export async function wipCommit(
  execGit: ExecGit,
  message: string,
): Promise<WipCommitResult> {
  try {
    await execGit(["add", "-A"]);
    const status = await execGit(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
      return { ok: true, committed: false };
    }
    await execGit(["commit", "-m", message]);
    return { ok: true, committed: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "wipCommit failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
