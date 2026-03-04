---
id: 12
title: Update pipeline-tool.ts to use discriminated union checks
status: approved
depends_on:
  - 6
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-tool.ts
  - tests/pipeline-tool.test.ts
files_to_create: []
---

### Task 12: Update pipeline-tool.ts to use discriminated union checks [depends: 6, 8]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-tool.test.ts`:

```typescript
  it("uses discriminated union checks (no as-any casts)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/pipeline-tool.ts"),
      "utf-8",
    );
    expect(source).not.toContain("(ws as any).error");
    expect(source).not.toContain("(squash as any).error");
    // Should use .ok checks instead
    expect(source).toContain(".ok");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: FAIL — Expected source to not contain "(ws as any).error" (line 90 has `(ws as any).error`, line 120 has `(squash as any).error`)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/pipeline-tool.ts`, replace the two `(as any).error` casts:

**Line ~89-91** (workspace creation):
```typescript
    const ws = await createPipelineWorkspace(projectRoot, pipelineId, execGit);
    if (!ws.ok) return { error: `Workspace creation failed: ${ws.error}` };
    workspacePath = ws.workspacePath;
```

**Line ~118-120** (squash):
```typescript
  if (result.status === "completed") {
    const squash = await squashPipelineWorkspace(projectRoot, pipelineId, execGit);
    if (!squash.ok) return { error: `Squash failed: ${squash.error}`, pipelineId, result };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
