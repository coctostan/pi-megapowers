---
id: 5
title: Verify step-end events for implement and review include messages (AC16)
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - tests/pipeline-runner.test.ts
files_to_create: []
---

### Task 5: Verify step-end events for implement and review include messages (AC16) [depends: 2]

**Files:**
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-runner.test.ts` inside the existing describe block:
```typescript
  it("step-end events for implement and review include messages (AC16)", async () => {
    const events: PipelineProgressEvent[] = [];

    const implMessages = [
      {
        role: "assistant" as const,
        content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }],
        usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 } },
        model: "claude-sonnet-4-20250514",
      },
    ] as any;

    const reviewMessages = [
      {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n\nLooks good." }],
        usage: { input: 200, output: 30, cacheRead: 0, cacheWrite: 0, totalTokens: 230, cost: { input: 0.02, output: 0.01, cacheRead: 0, cacheWrite: 0, total: 0.03 } },
        model: "claude-sonnet-4-20250514",
      },
    ] as any;

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        if (cfg.agent === "implementer") return mkDispatch(0, { messages: implMessages });
        if (cfg.agent === "reviewer") return mkDispatch(0, { messages: reviewMessages });
        return mkDispatch(1, { error: "unknown" });
      },
    };

    await runPipeline(
      { taskDescription: "Do task" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe-msgs",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
        onProgress: (e) => events.push(e),
      },
    );

    const stepEnds = events.filter((e) => e.type === "step-end") as Array<Extract<PipelineProgressEvent, { type: "step-end" }>>;

    // implement step-end has messages
    const implEnd = stepEnds.find((e) => e.step === "implement");
    expect(implEnd).toBeDefined();
    expect(implEnd!.messages).toBeDefined();
    expect(implEnd!.messages).toHaveLength(1);

    // review step-end has messages
    const reviewEnd = stepEnds.find((e) => e.step === "review");
    expect(reviewEnd).toBeDefined();
    expect(reviewEnd!.messages).toBeDefined();
    expect(reviewEnd!.messages).toHaveLength(1);

    // verify step-end does NOT have messages (shell command, not LLM)
    const verifyEnd = stepEnds.find((e) => e.step === "verify");
    expect(verifyEnd).toBeDefined();
    expect(verifyEnd!.messages).toBeUndefined();
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "step-end events for implement and review include messages"`
Expected: FAIL if messages aren't being passed in step-end events, or PASS if Task 2 already included them. This test validates AC16 explicitly.

**Step 3 — Write minimal implementation**

If Task 2's implementation already includes `messages: impl.messages` and `messages: review.messages` in the step-end events (and omits messages for verify step-end), no changes needed. Otherwise, ensure:

- Implement step-end: `onProgress?.({ type: "step-end", step: "implement", durationMs: ..., error: ..., messages: impl.messages })`
- Review step-end: `onProgress?.({ type: "step-end", step: "review", durationMs: ..., error: ..., messages: review.messages })`
- Verify step-end: `onProgress?.({ type: "step-end", step: "verify", durationMs: ..., error: ... })` — no messages field

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "step-end events for implement and review include messages"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
