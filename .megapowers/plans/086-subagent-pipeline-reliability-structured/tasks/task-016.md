---
id: 16
title: Add pipeline-tool integration test verifying exactly 2 agents dispatched
status: approved
depends_on:
  - 14
no_test: true
files_to_modify:
  - tests/pipeline-tool.test.ts
files_to_create: []
---

### Task 16: Add pipeline-tool integration test verifying exactly 2 agents dispatched [depends: 14]
**Files:**
- Modify: `tests/pipeline-tool.test.ts`
Task 14 already added `execShell` to `handlePipelineTool` and updated existing tests. This task adds one new focused test verifying AC15 (exactly 2 agents dispatched, no verifier) at the pipeline-tool integration level.

**Step 1 — Write the failing test**

Add this new test inside the `describe("handlePipelineTool")` block in `tests/pipeline-tool.test.ts`:

```typescript
  it("pipeline dispatches exactly 2 agents (no verifier), uses shell verify via execShell (AC15)", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);
    const agentsCalled: string[] = [];
    const execGit = async (args: string[]) => {
      if (args.includes("--stat")) return { stdout: "src/file.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
        return { stdout: "diff --git ...", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const mockExecShell: ExecShell = async () => ({
      exitCode: 0,
      stdout: "3 pass\n0 fail",
      stderr: "",
    });

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        agentsCalled.push(cfg.agent);
        if (cfg.agent === "implementer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/x.ts" } }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        if (cfg.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };
    const r = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit, mockExecShell);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");
    // AC15: No "verifier" in the agents called — only implementer + reviewer
    expect(agentsCalled).not.toContain("verifier");
    expect(agentsCalled.filter((a) => a === "implementer").length).toBe(1);
    expect(agentsCalled.filter((a) => a === "reviewer").length).toBe(1);
  });
```
**Step 2 — Verify**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS — the new regression guard test passes because Task 14 already removed the verifier agent.
Run: `bun test`
Expected: all passing.

**Justification for [no-test]:** Regression guard test only — no production code change. Task 14 already removed the verifier agent; this test prevents re-introduction. No RED phase is possible since the behavioral change was made in Task 14.
