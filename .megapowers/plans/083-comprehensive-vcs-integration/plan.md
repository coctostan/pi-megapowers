# Plan

### Task 1: createBranch in git-ops.ts

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

### Task 2: checkoutBranch in git-ops.ts [depends: 1]

### Task 2: checkoutBranch in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { checkoutBranch } from "../extensions/megapowers/vcs/git-ops.js";

describe("checkoutBranch", () => {
  it("calls git checkout with branch name", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await checkoutBranch(execGit, "feat/my-feature");
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["checkout", "feat/my-feature"]]);
  });

  it("returns ok: false with error message when git fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("pathspec 'feat/missing' did not match");
    };

    const result = await checkoutBranch(execGit, "feat/missing");
    expect(result).toEqual({ ok: false, error: "pathspec 'feat/missing' did not match" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — checkoutBranch is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
/**
 * AC3: Check out an existing branch.
 * Runs `git checkout <branchName>`.
 */
export async function checkoutBranch(
  execGit: ExecGit,
  branchName: string,
): Promise<GitResult> {
  try {
    await execGit(["checkout", branchName]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "checkoutBranch failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: wipCommit in git-ops.ts [depends: 1]

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

### Task 4: squashOnto in git-ops.ts [depends: 1]

### Task 4: squashOnto in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { squashOnto, type SquashResult } from "../extensions/megapowers/vcs/git-ops.js";

describe("squashOnto", () => {
  it("performs soft reset and commits when there are changes (AC5)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete feature");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
      ["commit", "-m", "feat: complete feature"],
    ]);
  });

  it("returns committed: false when nothing to commit after reset (AC5)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete");
    expect(result).toEqual({ ok: true, committed: false });
    // Should not call commit
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
    ]);
  });

  it("returns ok: false when reset fails (AC23)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed: ambiguous argument");
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete");
    expect(result).toEqual({ ok: false, error: "reset failed: ambiguous argument" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — squashOnto is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
export type SquashResult = { ok: true; committed: boolean } | { ok: false; error: string };

/**
 * AC5: Soft-reset to base branch and commit all changes as a single squash commit.
 * Returns committed: false when there is nothing to commit after reset.
 */
export async function squashOnto(
  execGit: ExecGit,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashResult> {
  try {
    await execGit(["reset", "--soft", baseBranch]);
    const status = await execGit(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
      return { ok: true, committed: false };
    }
    await execGit(["commit", "-m", commitMessage]);
    return { ok: true, committed: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "squashOnto failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: pushBranch in git-ops.ts [depends: 1]

### Task 5: pushBranch in git-ops.ts [depends: 1]

**Files:**
- Modify: `extensions/megapowers/vcs/git-ops.ts`
- Modify: `tests/git-ops.test.ts`

**Step 1 — Write the failing test**

Add to `tests/git-ops.test.ts`:

```typescript
import { pushBranch } from "../extensions/megapowers/vcs/git-ops.js";

describe("pushBranch", () => {
  it("pushes to origin without force flag (AC6)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await pushBranch(execGit, "feat/my-feature", false);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["push", "origin", "feat/my-feature"]]);
  });

  it("pushes with --force-with-lease when force is true (AC6)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await pushBranch(execGit, "feat/my-feature", true);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["push", "origin", "feat/my-feature", "--force-with-lease"]]);
  });

  it("returns ok: false when push fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("remote: permission denied");
    };

    const result = await pushBranch(execGit, "feat/my-feature", false);
    expect(result).toEqual({ ok: false, error: "remote: permission denied" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/git-ops.test.ts`
Expected: FAIL — pushBranch is not exported from git-ops.js

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/vcs/git-ops.ts`:

```typescript
/**
 * AC6: Push a branch to origin.
 * Uses --force-with-lease when force is true (safe force push after squash).
 */
export async function pushBranch(
  execGit: ExecGit,
  branchName: string,
  force: boolean,
): Promise<GitResult> {
  try {
    const args = ["push", "origin", branchName];
    if (force) args.push("--force-with-lease");
    await execGit(args);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "pushBranch failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/git-ops.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: ensureBranch in branch-manager.ts [depends: 1, 2]

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

### Task 7: switchAwayCommit in branch-manager.ts [depends: 3, 6]

### Task 7: switchAwayCommit in branch-manager.ts [depends: 3, 6]

**Files:**
- Modify: `extensions/megapowers/vcs/branch-manager.ts`
- Modify: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**

Add to `tests/branch-manager.test.ts`:

```typescript
import { switchAwayCommit } from "../extensions/megapowers/vcs/branch-manager.js";

describe("switchAwayCommit", () => {
  it("performs WIP commit with branch name in message (AC9)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await switchAwayCommit(execGit, "feat/old-feature");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/old-feature")).toBe(true);
  });

  it("returns committed: false when working tree is clean (AC9)", async () => {
    const execGit: ExecGit = async () => {
      return { stdout: "", stderr: "" };
    };

    const result = await switchAwayCommit(execGit, "feat/old-feature");
    expect(result).toEqual({ ok: true, committed: false });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts`
Expected: FAIL — switchAwayCommit is not exported from branch-manager.js

**Step 3 — Write minimal implementation**

Add import and function to `extensions/megapowers/vcs/branch-manager.ts`:

Update the import line to include `wipCommit` and `WipCommitResult`:
```typescript
import { createBranch, checkoutBranch, wipCommit, type ExecGit, type WipCommitResult } from "./git-ops.js";
```

Add the function:
```typescript
/**
 * AC9: Perform a WIP commit on the current branch before switching away.
 * Message format: "WIP: <currentBranch>". Skips if working tree is clean.
 */
export async function switchAwayCommit(
  execGit: ExecGit,
  currentBranch: string,
): Promise<WipCommitResult> {
  return wipCommit(execGit, `WIP: ${currentBranch}`);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: squashAndPush in branch-manager.ts [depends: 4, 5, 6]

### Task 8: squashAndPush in branch-manager.ts [depends: 4, 5, 6]

**Files:**
- Modify: `extensions/megapowers/vcs/branch-manager.ts`
- Modify: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**

Add to `tests/branch-manager.test.ts`:

```typescript
import { squashAndPush } from "../extensions/megapowers/vcs/branch-manager.js";

describe("squashAndPush", () => {
  it("squashes onto base and force-pushes on success (AC10)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: true });
    expect(calls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
    expect(calls.some(c => c[0] === "push" && c.includes("--force-with-lease"))).toBe(true);
  });

  it("returns step: squash when squash fails (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed");
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: false, error: "reset failed", step: "squash" });
  });

  it("returns step: push when push fails (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "push") throw new Error("remote rejected");
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: false, error: "remote rejected", step: "push" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts`
Expected: FAIL — squashAndPush is not exported from branch-manager.js

**Step 3 — Write minimal implementation**

Add import and function to `extensions/megapowers/vcs/branch-manager.ts`:

Update the import line to include `squashOnto` and `pushBranch`:
```typescript
import {
  createBranch, checkoutBranch, wipCommit, squashOnto, pushBranch,
  type ExecGit, type WipCommitResult,
} from "./git-ops.js";
```

Add the type and function:
```typescript
export type SquashAndPushResult = { ok: true } | { ok: false; error: string; step: "squash" | "push" };

/**
 * AC10: Squash all commits onto base branch and force-push.
 * Returns the failing step name on error for targeted retry/reporting.
 */
export async function squashAndPush(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashAndPushResult> {
  const squashResult = await squashOnto(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }

  const pushResult = await pushBranch(execGit, branchName, true);
  if (!pushResult.ok) {
    return { ok: false, error: pushResult.error, step: "push" };
  }

  return { ok: true };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: createPR in pr-creator.ts

### Task 9: createPR in pr-creator.ts

**Files:**
- Create: `extensions/megapowers/vcs/pr-creator.ts`
- Create: `tests/pr-creator.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pr-creator.test.ts
import { describe, it, expect } from "bun:test";
import { createPR, type ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";

describe("createPR", () => {
  it("creates PR with correct gh arguments and returns URL (AC12)", async () => {
    const calls: { cmd: string; args: string[] }[] = [];
    const execCmd: ExecCmd = async (cmd, args) => {
      calls.push({ cmd, args });
      if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
      return { stdout: "gh version 2.0.0\n", stderr: "" };
    };

    const result = await createPR(execCmd, "feat/my-feature", "Add feature", "Feature body");
    expect(result).toEqual({ ok: true, url: "https://github.com/org/repo/pull/42" });
    expect(calls[1]).toEqual({
      cmd: "gh",
      args: ["pr", "create", "--title", "Add feature", "--body", "Feature body", "--head", "feat/my-feature"],
    });
  });

  it("returns skipped when gh is not installed (AC12)", async () => {
    const execCmd: ExecCmd = async () => {
      throw new Error("command not found: gh");
    };

    const result = await createPR(execCmd, "feat/my-feature", "Title", "Body");
    expect(result).toEqual({ skipped: true, reason: "gh CLI not installed" });
  });

  it("returns ok: false when gh pr create fails (AC12)", async () => {
    const execCmd: ExecCmd = async (_cmd, args) => {
      if (args[0] === "pr") throw new Error("authentication required");
      return { stdout: "gh version 2.0.0\n", stderr: "" };
    };

    const result = await createPR(execCmd, "feat/my-feature", "Title", "Body");
    expect(result).toEqual({ ok: false, error: "authentication required" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pr-creator.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/vcs/pr-creator.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/vcs/pr-creator.ts

/** Injected command executor — throws on non-zero exit. */
export type ExecCmd = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export type PRResult =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

/**
 * AC11, AC12: Create a GitHub PR via `gh` CLI.
 * Checks gh availability first; returns skipped if not installed.
 */
export async function createPR(
  execCmd: ExecCmd,
  branchName: string,
  title: string,
  body: string,
): Promise<PRResult> {
  // Check gh availability
  try {
    await execCmd("gh", ["--version"]);
  } catch {
    return { skipped: true, reason: "gh CLI not installed" };
  }

  try {
    const result = await execCmd("gh", [
      "pr", "create",
      "--title", title,
      "--body", body,
      "--head", branchName,
    ]);
    const url = result.stdout.trim();
    return { ok: true, url };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "createPR failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pr-creator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 10: Add branchName and baseBranch to MegapowersState

### Task 10: Add branchName to MegapowersState (AC13) and persist baseBranch to support done-phase squash (supports AC18)

**Justification for baseBranch (intentional extension beyond AC13 text, needed to fulfill AC18 behavior):**
AC13 specifies adding `branchName`. `baseBranch` is added as a co-field because AC18 requires calling
`squashAndPush(execGit, branchName, baseBranch, commitMessage)` in the done phase — and the spec's Out of
Scope section confirms the base branch is always the branch that was current at issue activation time.
There is no way to recover this value later (git history would be ambiguous), so it must be persisted
alongside `branchName` when the issue is first activated (Task 12). Both fields default to `null` and
both are included in `KNOWN_KEYS` to survive state round-trips.

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Modify: `extensions/megapowers/state/state-io.ts`
- Modify: `tests/state-io.test.ts`

**Step 1 — Write the failing test**

Add to `tests/state-io.test.ts` inside the existing `describe("state-io")` block:

```typescript
it("persists and reads branchName field (AC13)", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    branchName: "feat/001-test",
  };
  writeState(tmp, state);
  const read = readState(tmp);
  expect(read.branchName).toBe("feat/001-test");
});

it("persists and reads baseBranch field (required to support AC18 squashAndPush)", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    branchName: "feat/001-test",
    baseBranch: "main",
  };
  writeState(tmp, state);
  const read = readState(tmp);
  expect(read.baseBranch).toBe("main");
});

it("defaults branchName and baseBranch to null when not in state.json", () => {
  const state = readState(tmp);
  expect(state.branchName).toBeNull();
  expect(state.baseBranch).toBeNull();
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-io.test.ts`
Expected: FAIL — Property 'branchName' does not exist on type 'MegapowersState'

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`, add to the `MegapowersState` interface:

```typescript
  branchName: string | null;
  baseBranch: string | null;
```

And in `createInitialState()`, add:

```typescript
    branchName: null,
    baseBranch: null,
```

In `extensions/megapowers/state/state-io.ts`, update `KNOWN_KEYS`:

```typescript
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "version", "activeIssue", "workflow", "phase", "phaseHistory",
  "reviewApproved", "planMode", "planIteration", "currentTaskIndex", "completedTasks",
  "tddTaskState", "doneActions", "megaEnabled", "branchName", "baseBranch",
]);
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-io.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Done checklist push-and-pr item

### Task 11: Done checklist push-and-pr item

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to `tests/ui.test.ts` inside the existing `describe("getDoneChecklistItems (AC12)")` block:

```typescript
it("includes push-and-pr item checked by default (AC17)", () => {
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "done",
  };
  const items = getDoneChecklistItems(state);
  const pushItem = items.find(i => i.key === "push-and-pr");
  expect(pushItem).toBeDefined();
  expect(pushItem!.label).toBe("Push & create PR");
  expect(pushItem!.defaultChecked).toBe(true);
});

it("includes push-and-pr in bugfix workflow too (AC17)", () => {
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "bugfix",
    phase: "done",
  };
  const items = getDoneChecklistItems(state);
  const keys = items.map(i => i.key);
  expect(keys).toContain("push-and-pr");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts`
Expected: FAIL — expect(received).toBeDefined() — pushItem is undefined because "push-and-pr" is not in the checklist

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, in `getDoneChecklistItems`, add the push-and-pr item before the close-issue item. The function currently ends with:

```typescript
  items.push({ key: "close-issue", label: "Close issue", defaultChecked: true });
  return items;
```

Insert before that line:

```typescript
  items.push({ key: "push-and-pr", label: "Push & create PR", defaultChecked: true });
```

So the final ordering is: generate-docs/generate-bugfix-summary → write-changelog → capture-learnings → push-and-pr → close-issue.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

**Note:** The existing test "feature workflow: returns generate-docs, write-changelog, capture-learnings, close-issue all defaultChecked" checks `items.length >= 4`. With push-and-pr added, it becomes 5 items. The `>= 4` assertion still passes. The existing `every(defaultChecked === true)` assertion also passes since push-and-pr is defaultChecked.

### Task 12: ensureBranch on issue activation [depends: 6, 10]

### Task 12: ensureBranch on issue activation [depends: 6, 10]

**Architecture note — why `commands.ts`, not `ui.ts`:**
AC14 says “when an issue is activated via `/issue list` or `/issue new` (in `ui.ts`)” — the parenthetical
identifies *where* activation occurs, not *where* to wire VCS. Putting VCS calls inside `ui.ts` would
require the UI layer to accept an `execGit` dependency, coupling presentation logic to VCS. Instead,
`commands.ts:handleIssueCommand` is the natural orchestration point: it already wraps `ui.handleIssueCommand`,
reads prev/new state, and holds the `deps` object (which will include `execGit`). VCS is a post-activation
side-effect, analogous to the `writeState` call that also lives in `commands.ts` rather than `ui.ts`.

**ExecGit availability (resolves review concern):** `ensureDeps()` always initializes `deps.execGit`.
Graceful degradation is handled by `ensureBranch()` returning structured errors when git/VCS is unavailable
(e.g. not a git repo via `rev-parse --git-dir`, AC21) and surfacing those via `ctx.ui.notify` (AC16).
We do not treat “missing execGit” as a real runtime path, so the plan does not include a test for it.

**Capturing `baseBranch`:** `ensureBranch` returns only `{ branchName }` per AC8. To also persist
`baseBranch` for the done-phase squash (AC18), `commands.ts` captures the current HEAD via a separate
`git rev-parse --abbrev-ref HEAD` call *before* `ensureBranch` switches branches. This value is saved
to `state.baseBranch` alongside `state.branchName`.

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Create: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/vcs-commands.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleIssueCommand } from "../extensions/megapowers/commands.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

function makeMockUI(newActiveIssue: string, newWorkflow: "feature" | "bugfix" = "feature") {
  return {
    handleIssueCommand: async () => ({
      ...createInitialState(),
      activeIssue: newActiveIssue,
      workflow: newWorkflow,
      phase: newWorkflow === "feature" ? "brainstorm" as const : "reproduce" as const,
    }),
    renderDashboard: () => {},
    updateStatus: () => {},
    handleTriageCommand: async (s: any) => s,
  };
}

describe("handleIssueCommand — VCS ensureBranch on activation (AC14)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-cmd-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("calls ensureBranch, saves branchName and baseBranch to state (AC14)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      // rev-parse --abbrev-ref: called once by commands.ts to capture baseBranch (before switching branches)
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      // rev-parse --verify: branch doesn't exist yet
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("001-my-feature"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    const state = readState(tmp);
    expect(state.branchName).toBe("feat/001-my-feature");
    // baseBranch captured via separate rev-parse --abbrev-ref before branch switch
    expect(state.baseBranch).toBe("main");
    expect(calls.some(c => c[0] === "checkout" && c[1] === "-b")).toBe(true);
    // ensureBranch creates from HEAD; it should not need to resolve current branch name itself
    expect(calls.filter((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref").length).toBe(1);
  });

  it("surfaces ensureBranch error via notify without blocking activation (AC16)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--git-dir") throw new Error("not a repo");
      return { stdout: "", stderr: "" };
    };

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("001-my-feature"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await handleIssueCommand("list", ctx, deps);

    // Issue should still be activated
    const state = readState(tmp);
    expect(state.activeIssue).toBe("001-my-feature");
    expect(state.branchName).toBeNull();

    // Error should be notified
    expect(notifications.some(n => n.type === "error")).toBe(true);
  });

  it("does not call ensureBranch when issue does not change", async () => {
    // Pre-set state with same active issue
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-my-feature",
      workflow: "feature",
      phase: "brainstorm",
    });

    let execGitCalled = false;
    const execGit: ExecGit = async () => {
      execGitCalled = true;
      return { stdout: "", stderr: "" };
    };

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("001-my-feature"), // same issue
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    expect(execGitCalled).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts`
Expected: FAIL — state.branchName is null (VCS not called yet)

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/commands.ts`:

Add imports at the top:
```typescript
import { ensureBranch } from "./vcs/branch-manager.js";
import type { ExecGit } from "./vcs/git-ops.js";
```

Update the type definitions:
```typescript
/** Mutable container — exactly one instance lives in index.ts, shared by all hooks and commands */
export type RuntimeDeps = { store?: Store; ui?: MegapowersUI; execGit?: ExecGit };

/** Resolved deps — guaranteed non-optional (except optional VCS) */
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI; execGit?: ExecGit };
```

Update `ensureDeps` to create `execGit`:
```typescript
export function ensureDeps(rd: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!rd.store) rd.store = createStore(cwd);
  if (!rd.ui) rd.ui = createUI();
  if (!rd.execGit) {
    rd.execGit = async (args: string[]) => {
      const r = await pi.exec("git", args);
      if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    };
  }
  return { pi, store: rd.store, ui: rd.ui, execGit: rd.execGit };
}
```

Update `handleIssueCommand` — note the separate baseBranch capture BEFORE ensureBranch
switches the branch, so we record the branch that was current at activation time:
```typescript
export async function handleIssueCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const prevState = readState(ctx.cwd);
  const newState = await deps.ui.handleIssueCommand(ctx, prevState, deps.store, args);

  // AC14: VCS branch management on issue activation.
  // Wired here in commands.ts (the orchestration wrapper) rather than ui.ts because:
  //   1) commands.ts holds deps.execGit while ui.ts has no VCS dependency
  //   2) the before/after state comparison (prevState vs newState) is naturally here
  //   3) VCS is a post-activation side-effect, like writeState, which also lives here
  if (deps.execGit && newState.activeIssue && newState.activeIssue !== prevState.activeIssue && newState.workflow) {
    // Capture current HEAD *before* ensureBranch switches branches.
    // This baseBranch is persisted to state for use by squashAndPush in the done phase (AC18).
    let baseBranch: string | null = null;
    try {
      const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
      baseBranch = r.stdout.trim() || null;
    } catch { /* ignore — baseBranch stays null */ }

    const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
    if ("branchName" in result) {
      newState.branchName = result.branchName;
      newState.baseBranch = baseBranch;
    } else {
      // AC16: surface error, don't block activation
      if (ctx.hasUI) ctx.ui.notify(`VCS: ${result.error}`, "error");
    }
  }

  writeState(ctx.cwd, newState);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-commands.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 13: switchAwayCommit on issue switch [depends: 7, 12]

### Task 13: switchAwayCommit on issue switch [depends: 7, 12]

**Architecture note (same as Task 12):** The switchAwayCommit call is wired in `commands.ts` (not `ui.ts`)
for the same reasons stated in Task 12: `commands.ts` holds `deps.execGit`, can compare prev/new state,
and is the correct orchestration layer for post-activation side-effects. The AC15 switch logic is added
before the `ensureBranch` call from Task 12, so the WIP commit on the old branch happens before the new
branch is checked out.

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**

Add to `tests/vcs-commands.test.ts`:

```typescript
import { switchAwayCommit } from "../extensions/megapowers/vcs/branch-manager.js";

describe("handleIssueCommand — VCS switchAwayCommit on issue switch (AC15)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-switch-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("calls switchAwayCommit with previous branchName before activating new issue", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "feat/001-old-issue\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    // Pre-populate state with an active issue and branch
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: "feat/001-old-issue",
    });

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    // Should have WIP committed on old branch
    expect(calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/001-old-issue")).toBe(true);
    // Should have created new branch
    const state = readState(tmp);
    expect(state.branchName).toBe("feat/002-new-issue");
  });

  it("skips switchAwayCommit when previous state has no branchName", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    // Pre-populate state with active issue but no branch
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: null,
    });

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    // Should NOT have called WIP commit (no old branch)
    expect(calls.some(c => c[0] === "commit")).toBe(false);
    // Should still create new branch
    expect(readState(tmp).branchName).toBe("feat/002-new-issue");
  });

  it("surfaces switchAwayCommit error via notify without blocking (AC16)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "add") throw new Error("index lock failed");
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: "feat/001-old-issue",
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await handleIssueCommand("list", ctx, deps);

    // switchAwayCommit error notified
    expect(notifications.some(n => n.type === "error")).toBe(true);
    // New issue still activated (not blocked)
    expect(readState(tmp).activeIssue).toBe("002-new-issue");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts`
Expected: FAIL — WIP commit call not found in calls (switchAwayCommit not called yet)

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/commands.ts`:

Add import:
```typescript
import { ensureBranch, switchAwayCommit } from "./vcs/branch-manager.js";
```
(Update the existing `ensureBranch` import to also include `switchAwayCommit`.)

Update the import (added in Task 12) to also include `switchAwayCommit`:
```typescript
import { ensureBranch, switchAwayCommit } from "./vcs/branch-manager.js";
```

Update `handleIssueCommand` to add switchAwayCommit BEFORE the baseBranch capture and ensureBranch
call (which were added in Task 12). The complete function body becomes:
```typescript
export async function handleIssueCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const prevState = readState(ctx.cwd);
  const newState = await deps.ui.handleIssueCommand(ctx, prevState, deps.store, args);

  // VCS: branch management on issue activation / switch
  if (deps.execGit && newState.activeIssue && newState.activeIssue !== prevState.activeIssue && newState.workflow) {
    // AC15: WIP commit on previous issue's branch before switching away
    if (prevState.branchName) {
      const switchResult = await switchAwayCommit(deps.execGit, prevState.branchName);
      if (!switchResult.ok) {
        // AC16: surface error, don't block
        if (ctx.hasUI) ctx.ui.notify(`VCS: ${switchResult.error}`, "error");
      }
    }

    // Capture current HEAD before ensureBranch switches branches (for baseBranch persistence)
    let baseBranch: string | null = null;
    try {
      const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
      baseBranch = r.stdout.trim() || null;
    } catch { /* ignore */ }

    // AC14: ensure branch for new issue
    const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
    if ("branchName" in result) {
      newState.branchName = result.branchName;
      newState.baseBranch = baseBranch;
    } else {
      if (ctx.hasUI) ctx.ui.notify(`VCS: ${result.error}`, "error");
    }
  }

  writeState(ctx.cwd, newState);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-commands.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 14: Done action handler for push-and-pr [depends: 8, 9, 10, 11, 12, 13]

### Task 14: Done action handler for push-and-pr [depends: 8, 9, 10, 11, 12, 13]

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `extensions/megapowers/hooks.ts`
- Modify: `tests/hooks.test.ts`

**Step 1 — Write the failing test**

Add to `tests/hooks.test.ts`:

First, add required imports at the top of `tests/hooks.test.ts`:
```typescript
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";
```

**Note on `state.baseBranch`:** Tests set `baseBranch: "main"` in the initial state. This field is captured
at issue-activation time (Task 12). For graceful degradation, if `baseBranch` is missing we **notify error**
and **consume** the action (so done-phase completion is never blocked).

Then add these test cases:

```typescript
describe("onAgentEnd — push-and-pr done action (AC18, AC19, AC20)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-pr-test-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("AC18: calls squashAndPush then createPR and removes action on success", async () => {
    const gitCalls: string[][] = [];
    const cmdCalls: { cmd: string; args: string[] }[] = [];

    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async (cmd, args) => {
      cmdCalls.push({ cmd, args });
      if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/1\n", stderr: "" };
      return { stdout: "gh version 2.0\n", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const store = {
      ...makeStore(tmp),
      getIssue: () => ({ title: "Test Feature", description: "A test feature" }),
      getSourceIssues: () => [],
    };
    const deps = {
      store,
      ui: { renderDashboard: () => {} },
      execGit,
      execCmd,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Squash should have been called
    expect(gitCalls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
    // Push should have been called with force
    expect(gitCalls.some(c => c[0] === "push" && c.includes("--force-with-lease"))).toBe(true);
    // PR should have been created
    expect(cmdCalls.some(c => c.args[0] === "pr" && c.args[1] === "create")).toBe(true);
    // Action should be consumed
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    // Success notification
    expect(notifications.some(n => n.msg.includes("PR created"))).toBe(true);
  });

  it("AC19: does not consume action when squash fails", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getIssue: () => null, getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
      execGit,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Action should NOT be consumed (retry possible)
    expect(readState(tmp).doneActions).toContain("push-and-pr");
    // Error should be notified
    expect(notifications.some(n => n.type === "error" && n.msg.includes("squash"))).toBe(true);
  });

  it("AC20: notifies when PR creation is skipped (no gh)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async () => {
      throw new Error("command not found: gh");
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getIssue: () => ({ title: "Test" }), getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
      execGit,
      execCmd,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Action should be consumed (push succeeded)
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    // Notification about PR being skipped
    expect(notifications.some(n => n.msg.includes("skipped"))).toBe(true);
  });

  it("consumes action and notifies error when baseBranch is missing", async () => {
    const execGit: ExecGit = async () => {
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: null,
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
      execGit,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    expect(notifications.some((n) => n.type === "error" && n.msg.includes("baseBranch"))).toBe(true);
  });

  it("notifies error (and consumes action) when PR creation fails after push", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async (cmd, args) => {
      if (cmd === "gh" && args[0] === "--version") return { stdout: "gh version 2.0\n", stderr: "" };
      if (cmd === "gh" && args[0] === "pr") throw new Error("gh pr create failed");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const store = {
      ...makeStore(tmp),
      getIssue: () => ({ title: "Test Feature", description: "A test feature" }),
      getSourceIssues: () => [],
    };
    const deps = {
      store,
      ui: { renderDashboard: () => {} },
      execGit,
      execCmd,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    expect(notifications.some((n) => n.type === "error" && n.msg.includes("PR creation failed"))).toBe(true);
  });
  it("consumes action and skips VCS when branchName is null", async () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: null,
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Action should be consumed (nothing to push)
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    // Info notification about no branch
    expect(notifications.some(n => n.msg.includes("No branch"))).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks.test.ts`
Expected: FAIL — push-and-pr action is not handled, falls through to content-capture section which doesn't consume it

**Step 3 — Write minimal implementation**

**3a. Add `execCmd` to deps in `extensions/megapowers/commands.ts`:**

Add import:
```typescript
import type { ExecCmd } from "./vcs/pr-creator.js";
```

Update types:
```typescript
export type RuntimeDeps = { store?: Store; ui?: MegapowersUI; execGit?: ExecGit; execCmd?: ExecCmd };
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI; execGit?: ExecGit; execCmd?: ExecCmd };
```

In `ensureDeps`, add after the `execGit` initialization:
```typescript
  if (!rd.execCmd) {
    rd.execCmd = async (cmd: string, args: string[]) => {
      const r = await pi.exec(cmd, args);
      if (r.code !== 0) throw new Error(`${cmd} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    };
  }
  return { pi, store: rd.store, ui: rd.ui, execGit: rd.execGit, execCmd: rd.execCmd };
```

**3b. Handle push-and-pr in `extensions/megapowers/hooks.ts`:**

Add imports:
```typescript
import { squashAndPush } from "./vcs/branch-manager.js";
import { createPR } from "./vcs/pr-creator.js";
```

In `onAgentEnd`, inside the `if (phase === "done" && state.doneActions.length > 0)` block, add a new immediate action handler BEFORE the `close-issue` check:

```typescript
    if (doneAction === "push-and-pr") {
      // AC18: Push & create PR
      if (!deps.execGit || !state.branchName) {
        // No VCS available or no branch tracked — skip and consume
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("VCS: No branch tracked — skipping push & PR.", "info");
        return;
      }

      if (!state.baseBranch) {
        // base branch unknown — can't safely squash. Degrade gracefully by consuming the action.
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("VCS: baseBranch is missing — skipping push & PR.", "error");
        return;
      }

      const baseBranch = state.baseBranch;
      const issue = store.getIssue(state.activeIssue);
      const commitPrefix = state.workflow === "bugfix" ? "fix" : "feat";
      const commitMsg = `${commitPrefix}: ${issue?.title ?? state.activeIssue}`;

      const pushResult = await squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg);
      if (!pushResult.ok) {
        // AC19: don't consume action on failure — user can retry
        if (ctx.hasUI) ctx.ui.notify(`Push failed (${pushResult.step}): ${pushResult.error}`, "error");
        return;
      }

      // Push succeeded — attempt PR creation
      if (deps.execCmd) {
        const prTitle = issue?.title ?? state.activeIssue;
        const prBody = `Resolves ${state.activeIssue}\n\n${issue?.description ?? ""}`.trim();
        const prResult = await createPR(deps.execCmd, state.branchName, prTitle, prBody);

        if ("skipped" in prResult) {
          // AC20: pushed but no PR
          if (ctx.hasUI) ctx.ui.notify(`Branch pushed. PR creation skipped: ${prResult.reason}`, "info");
        } else if (prResult.ok) {
          if (ctx.hasUI) ctx.ui.notify(`PR created: ${prResult.url}`, "info");
        } else {
          if (ctx.hasUI) ctx.ui.notify(`PR creation failed: ${prResult.error}`, "error");
        }
      } else {
        if (ctx.hasUI) ctx.ui.notify("Branch pushed. PR creation skipped (no execCmd).", "info");
      }

      // Consume action once push succeeds (even if PR creation fails) to avoid repeated force-push retries
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      return;
    }
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/hooks.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
