---
id: 4
title: checkBranchSync fails open when git fetch fails
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - tests/sync-check.test.ts
files_to_create: []
---

### Task 4: checkBranchSync fails open when git fetch fails [depends: 1]

**Files:**
- Modify: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

Add to `tests/sync-check.test.ts` inside the `describe("checkBranchSync", ...)` block:

```typescript
  it("returns hasRemote true, behind 0 when fetch fails — fail-open (AC6)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") throw new Error("Could not resolve host");
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 0, ahead: 0 });
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — This should pass with the existing implementation since Task 1 already catches fetch errors.

**Step 3 — Write minimal implementation**

No code changes needed — the implementation from Task 1 already catches fetch errors and returns fail-open.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — 4 tests passing

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
