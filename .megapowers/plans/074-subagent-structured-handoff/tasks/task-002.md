---
id: 2
title: Emit step-start and step-end events from runPipeline
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-runner.ts
  - tests/pipeline-runner.test.ts
files_to_create: []
---

### Task 2: Emit step-start and step-end events from runPipeline [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-runner.test.ts`:
```typescript
import type { PipelineProgressEvent } from "../extensions/megapowers/subagent/pipeline-renderer.js";

// ... inside the existing describe("runPipeline (refactored)") block:

  it("emits step-start and step-end progress events for happy path", async () => {
    const events: PipelineProgressEvent[] = [];

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }],
              },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [{
              role: "assistant" as const,
              content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n\nLooks good." }],
            }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Do task" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe-progress",
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

    expect(r.status).toBe("completed");

    // Should have: step-start implement, step-end implement, step-start verify, step-end verify, step-start review, step-end review
    const types = events.map((e) => `${e.type}:${"step" in e ? e.step : ""}`);
    expect(types).toEqual([
      "step-start:implement",
      "step-end:implement",
      "step-start:verify",
      "step-end:verify",
      "step-start:review",
      "step-end:review",
    ]);

    // step-end events have durationMs >= 0
    const stepEnds = events.filter((e) => e.type === "step-end") as Array<Extract<PipelineProgressEvent, { type: "step-end" }>>;
    for (const se of stepEnds) {
      expect(se.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "emits step-start and step-end"`
Expected: FAIL — `expect(received).toEqual(expected)` because `events` array is empty (no `onProgress` calls yet).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/pipeline-runner.ts`, modify `runPipeline` to call `onProgress` at each step boundary. Add these calls within the existing function body:

After `const execShell = options.execShell ?? defaultExecShell;` (around line 88), add:
```typescript
  const onProgress = options.onProgress;
```

Before the implement dispatch (around line 97, before `const t0`), add:
```typescript
    onProgress?.({ type: "step-start", step: "implement" });
```

After the implement log entry write (around line 118, after the `writeLogEntry` for implement), add:
```typescript
    onProgress?.({ type: "step-end", step: "implement", durationMs: Date.now() - t0, error: implParsed.error, messages: impl.messages });
```

Before the verify step (around line 141, before `const t1`), add:
```typescript
    onProgress?.({ type: "step-start", step: "verify" });
```

In the verify catch block (infrastructure failure, around line 154), add before `retryCount++`:
```typescript
      onProgress?.({ type: "step-end", step: "verify", durationMs: Date.now() - t1, error: verifyMsg });
```

After the normal verify `writeLogEntry` (around line 180), before the `if (!verify.passed)` check, add:
```typescript
    onProgress?.({ type: "step-end", step: "verify", durationMs: verify.durationMs, error: verify.passed ? undefined : `exit code ${verify.exitCode}` });
```

This gives exactly two verify step-end emission points: one for infrastructure failure (catch block) and one for normal pass/fail (after writeLogEntry). There is no third emission - the normal path emission handles both pass and fail via the ternary.
Before the review dispatch (around line 203, before `const t2`), add:
```typescript
    onProgress?.({ type: "step-start", step: "review" });
```

After the review log entry for success or failure, add:
```typescript
    onProgress?.({ type: "step-end", step: "review", durationMs: Date.now() - t2, error: review.exitCode !== 0 ? reviewParsed.error : (verdict.verdict === "reject" ? verdict.findings.join("; ") : undefined), messages: review.messages });
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "emits step-start and step-end"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
