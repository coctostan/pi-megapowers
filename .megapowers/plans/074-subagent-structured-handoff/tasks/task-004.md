---
id: 4
title: Verify no side effects when onProgress is omitted
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - tests/pipeline-runner.test.ts
files_to_create: []
---

### Task 4: Verify no side effects when onProgress is omitted [depends: 2]

**Files:**
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-runner.test.ts` inside the existing describe block:
```typescript
  it("runs without error when onProgress is omitted (AC5)", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    // No onProgress in options — should not throw
    const r = await runPipeline(
      { taskDescription: "Do task" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe-no-progress",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
        // onProgress intentionally NOT provided
      },
    );

    expect(r.status).toBe("completed");
    expect(r.reviewVerdict).toBe("approve");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "runs without error when onProgress is omitted"`
Expected: PASS — This test should already pass because `onProgress?.()` uses optional chaining. If it passes immediately, that confirms AC5. Run it to verify.

Actually, this test validates AC5 (no side effects when omitted). Since the implementation in Task 2 uses `onProgress?.()`, this should pass immediately after Task 2 is done. The test itself is the deliverable — it documents and guards the behavior.

**Step 3 — Write minimal implementation**

No implementation changes needed. The test validates existing behavior (optional chaining from Task 2).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "runs without error when onProgress is omitted"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
