---
id: 6
title: ensureBranch in branch-manager.ts
status: approved
depends_on:
  - 1
  - 2
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/vcs/branch-manager.ts
  - tests/branch-manager.test.ts
---

### Task 6: ensureBranch in branch-manager.ts [depends: 1, 2]

**Files:**
- Create: `extensions/megapowers/vcs/branch-manager.ts`
- Create: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/branch-manager.test.ts
import { describe, it, expect } from "bun:test";
import { ensureBranch } from "../extensions/megapowers/vcs/branch-manager.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

describe("ensureBranch", () => {
  it("creates feat/ branch for feature workflow and returns branchName only (AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      // no --abbrev-ref needed; ensureBranch creates from HEAD
      return { stdout: "", stderr: "" };
    };

    const result = await ensureBranch(execGit, "my-feature", "feature");
    // AC8: return type is { branchName: string } | { error: string } — no baseBranch field
    expect(result).toEqual({ branchName: "feat/my-feature" });
    expect(calls.some((c) => c[0] === "checkout" && c[1] === "-b" && c[2] === "feat/my-feature" && c[3] === "HEAD")).toBe(true);
    // ensureBranch should not need to resolve the current branch name (create from HEAD)
    expect(calls.some((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref")).toBe(false);
  });

  it("creates fix/ branch for bugfix workflow (AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      // no --abbrev-ref needed; ensureBranch creates from HEAD
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };
    const result = await ensureBranch(execGit, "broken-login", "bugfix");
    expect(result).toEqual({ branchName: "fix/broken-login" });
    expect(calls.some((c) => c[0] === "checkout" && c[1] === "-b" && c[2] === "fix/broken-login" && c[3] === "HEAD")).toBe(true);
  });

  it("checks out existing branch without creating (AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      // All git commands succeed — branch exists
      return { stdout: "", stderr: "" };
    };

    const result = await ensureBranch(execGit, "existing", "feature");
    expect(result).toEqual({ branchName: "feat/existing" });
    // Should have checked out, not created
    expect(calls.some(c => c[0] === "checkout" && c.length === 2 && c[1] === "feat/existing")).toBe(true);
    expect(calls.some(c => c[1] === "-b")).toBe(false);
  });

  it("returns error when not in a git repo (AC21)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--git-dir") throw new Error("not a git repo");
      return { stdout: "", stderr: "" };
    };

    const result = await ensureBranch(execGit, "my-feature", "feature");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("VCS features are unavailable");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/vcs/branch-manager.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/vcs/branch-manager.ts
import { createBranch, checkoutBranch, type ExecGit } from "./git-ops.js";

/** AC8: Return type matches spec exactly — no baseBranch exposed. */
export type EnsureBranchResult = { branchName: string } | { error: string };

/**
 * AC8: Generate branch name (feat/ or fix/), check if it exists, create or checkout.
 * AC21: Returns error when not in a git repository.
 *
 * Branch creation is always from the current `HEAD` (i.e. whatever is currently checked out).
 * If callers need to persist the *name* of that base branch (for done-phase squash), capture it
 * separately before calling ensureBranch (see Task 12).
 */
export async function ensureBranch(
  execGit: ExecGit,
  slug: string,
  workflow: "feature" | "bugfix",
): Promise<EnsureBranchResult> {
  const prefix = workflow === "feature" ? "feat" : "fix";
  const branchName = `${prefix}/${slug}`;

  // AC21: Check if we're in a git repo
  try {
    await execGit(["rev-parse", "--git-dir"]);
  } catch {
    return { error: "Not a git repository. VCS features are unavailable." };
  }

  // Check if branch already exists
  try {
    await execGit(["rev-parse", "--verify", branchName]);
    // Branch exists — check it out
    const result = await checkoutBranch(execGit, branchName);
    if (!result.ok) return { error: result.error };
    return { branchName };
  } catch {
    // Branch doesn't exist — create from current HEAD (AC8).
    const result = await createBranch(execGit, branchName, "HEAD");
    if (!result.ok) return { error: result.error };
    return { branchName };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
