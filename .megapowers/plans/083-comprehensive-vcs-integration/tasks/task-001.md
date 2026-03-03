---
id: 1
title: createBranch in git-ops.ts
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/vcs/git-ops.ts
  - tests/git-ops.test.ts
---

### Task 1: createBranch in git-ops.ts

**Files:**
- Create: `extensions/megapowers/vcs/git-ops.ts`
- Create: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/git-ops.test.ts
import { describe, it, expect } from "bun:test";
import { createBranch, type ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

describe("createBranch", () => {
  it("calls git checkout -b with branch name and base branch", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await createBranch(execGit, "feat/my-feature", "main");
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["checkout", "-b", "feat/my-feature", "main"]]);
  });

  it("returns ok: false with error message when git fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("branch already exists");
    };

    const result = await createBranch(execGit, "feat/my-feature", "main");
    expect(result).toEqual({ ok: false, error: "branch already exists" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/vcs/git-ops.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/vcs/git-ops.ts

/** Injected git executor — throws on non-zero exit. */
export type ExecGit = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

export type GitResult = { ok: true } | { ok: false; error: string };

/**
 * AC2: Create a new branch from a given base branch.
 * Runs `git checkout -b <branchName> <baseBranch>`.
 */
export async function createBranch(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
): Promise<GitResult> {
  try {
    await execGit(["checkout", "-b", branchName, baseBranch]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "createBranch failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
