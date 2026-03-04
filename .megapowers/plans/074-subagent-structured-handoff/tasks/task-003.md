---
id: 3
title: Emit retry events from runPipeline
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-runner.ts
  - tests/pipeline-runner.test.ts
files_to_create: []
---

### Task 3: Emit retry events from runPipeline [depends: 2]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-runner.test.ts` inside the existing describe block:
```typescript
  it("emits retry events when verify fails and retries", async () => {
    const events: PipelineProgressEvent[] = [];
    let implCount = 0;

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        if (cfg.agent === "implementer") {
          implCount++;
          return mkDispatch(0, { messages: [] as any });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe-retry",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: failingShell,
        maxRetries: 1,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
        onProgress: (e) => events.push(e),
      },
    );

    expect(r.status).toBe("paused");

    // Find retry events
    const retryEvents = events.filter((e) => e.type === "retry") as Array<Extract<PipelineProgressEvent, { type: "retry" }>>;
    expect(retryEvents).toHaveLength(1);
    expect(retryEvents[0].retryCount).toBe(1);
    expect(retryEvents[0].reason).toContain("verify_failed");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "emits retry events"`
Expected: FAIL — `expect(received).toHaveLength(expected)` — retryEvents length is 0 because no retry events are emitted yet.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/pipeline-runner.ts`, add `onProgress` calls for retry events at each retry point in the `runPipeline` function.
**Critical placement:** The retry event must fire AFTER the `if (cycle >= maxRetries) { ... return; }` check, not before it. When the retry budget is exhausted, the function returns `paused` without actually retrying — so no retry event should fire. Place each `onProgress` call between the exhaustion guard and `ctx = withRetryContext(...)`.

Specifically at these 5 locations:

1. Implement failure (around line 121). After `retryCount++` and after `if (cycle >= maxRetries) { ... return; }`, before `ctx = withRetryContext(...)`:
```typescript
      onProgress?.({ type: "retry", retryCount, reason: `implement_failed: ${implParsed.error ?? "unknown"}` });
```

2. Verify infrastructure failure (around line 155). After `retryCount++` and after `if (cycle >= maxRetries) { ... return; }`, before `ctx = withRetryContext(...)`:
```typescript
        onProgress?.({ type: "retry", retryCount, reason: `verify_failed: ${verifyMsg}` });
```

3. Verify test failure (around line 182). After `retryCount++` and after `if (cycle >= maxRetries) { ... return; }`, before `ctx = withRetryContext(...)`:
```typescript
      onProgress?.({ type: "retry", retryCount, reason: `verify_failed: tests failing` });
```

4. Review dispatch failure (around line 230). After `retryCount++` and after `if (cycle >= maxRetries) { ... return; }`, before `ctx = withRetryContext(...)`:
```typescript
      onProgress?.({ type: "retry", retryCount, reason: `review_failed: ${reviewParsed.error ?? "unknown"}` });
```

5. Review rejection (around line 272). After `retryCount++` and after `if (cycle >= maxRetries) { ... return; }`, before `ctx = withRetryContext(...)`:
```typescript
    onProgress?.({ type: "retry", retryCount, reason: `review_rejected: ${verdict.findings.join("; ")}` });
```

The pattern at each retry point is:
```typescript
retryCount++;
if (cycle >= maxRetries) {
    // ... return paused (NO retry event here — budget exhausted, no retry happens)
}
onProgress?.({ type: "retry", retryCount, reason: "..." });  // ← only fires if we actually retry
ctx = withRetryContext(ctx, { ... });
continue;
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts --test-name-pattern "emits retry events"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
