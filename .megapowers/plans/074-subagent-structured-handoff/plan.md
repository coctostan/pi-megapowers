# Plan

### Task 1: Define PipelineProgressEvent type and add onProgress to PipelineOptions

### Task 1: Define PipelineProgressEvent type and add onProgress to PipelineOptions

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pipeline-renderer.test.ts
import { describe, it, expect } from "bun:test";
import type {
  PipelineProgressEvent,
  StepName,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

describe("PipelineProgressEvent types", () => {
  it("step-start event has correct shape", () => {
    const event: PipelineProgressEvent = {
      type: "step-start",
      step: "implement",
    };
    expect(event.type).toBe("step-start");
    expect(event.step).toBe("implement");
  });

  it("step-end event has correct shape with optional messages and error", () => {
    const event: PipelineProgressEvent = {
      type: "step-end",
      step: "review",
      durationMs: 1234,
      messages: [],
    };
    expect(event.type).toBe("step-end");
    expect(event.step).toBe("review");
    expect(event.durationMs).toBe(1234);
    expect(event.messages).toEqual([]);

    // step-end for verify has no messages
    const verifyEnd: PipelineProgressEvent = {
      type: "step-end",
      step: "verify",
      durationMs: 500,
      error: "tests failed",
    };
    expect(verifyEnd.messages).toBeUndefined();
  });

  it("retry event has correct shape", () => {
    const event: PipelineProgressEvent = {
      type: "retry",
      retryCount: 2,
      reason: "verify_failed",
    };
    expect(event.type).toBe("retry");
    expect(event.retryCount).toBe(2);
    expect(event.reason).toBe("verify_failed");
  });

  it("StepName covers all three pipeline steps", () => {
    const steps: StepName[] = ["implement", "verify", "review"];
    expect(steps).toHaveLength(3);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts`
Expected: FAIL — `error: Could not resolve: "../extensions/megapowers/subagent/pipeline-renderer.js"`

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
import type { Message } from "@mariozechner/pi-ai";

export type StepName = "implement" | "verify" | "review";

export type PipelineProgressEvent =
  | { type: "step-start"; step: StepName }
  | { type: "step-end"; step: StepName; durationMs: number; error?: string; messages?: Message[] }
  | { type: "retry"; retryCount: number; reason: string };
```

Add to `extensions/megapowers/subagent/pipeline-runner.ts` — add the import and modify the `PipelineOptions` interface:

Add import at top:
```typescript
import type { PipelineProgressEvent } from "./pipeline-renderer.js";
```

Add to `PipelineOptions` interface after `execShell?`:
```typescript
  onProgress?: (event: PipelineProgressEvent) => void;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Emit step-start and step-end events from runPipeline [depends: 1]

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

### Task 3: Emit retry events from runPipeline [depends: 2]

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

### Task 4: Verify no side effects when onProgress is omitted [depends: 2]

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

### Task 5: Verify step-end events for implement and review include messages (AC16) [depends: 2]

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

### Task 6: Define PipelineToolDetails type [depends: 1]

### Task 6: Define PipelineToolDetails type [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
import type {
  PipelineProgressEvent,
  PipelineToolDetails,
  StepName,
  StepEntry,
  UsageStats,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

describe("PipelineToolDetails type", () => {
  it("can construct a PipelineToolDetails object with all required fields", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "running",
      steps: [],
      retryCount: 0,
      usageStats: {
        perStep: {},
        total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
      },
    };

    expect(details.taskIndex).toBe(1);
    expect(details.taskTitle).toBe("Implement parser");
    expect(details.pipelineId).toBe("pipe-t1-123");
    expect(details.status).toBe("running");
    expect(details.steps).toEqual([]);
    expect(details.retryCount).toBe(0);
    expect(details.usageStats.total.cost).toBe(0);
  });

  it("StepEntry has correct shape", () => {
    const entry: StepEntry = {
      step: "implement",
      status: "completed",
      durationMs: 5000,
    };
    expect(entry.step).toBe("implement");
    expect(entry.status).toBe("completed");
    expect(entry.durationMs).toBe(5000);
    expect(entry.error).toBeUndefined();

    const failed: StepEntry = {
      step: "verify",
      status: "failed",
      durationMs: 1000,
      error: "tests failed",
    };
    expect(failed.error).toBe("tests failed");
  });

  it("UsageStats has correct shape", () => {
    const stats: UsageStats = {
      input: 100,
      output: 50,
      cacheRead: 200,
      cacheWrite: 10,
      cost: 0.05,
      model: "claude-sonnet-4-20250514",
    };
    expect(stats.cost).toBe(0.05);
    expect(stats.model).toBe("claude-sonnet-4-20250514");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "PipelineToolDetails type"`
Expected: FAIL — `'"PipelineToolDetails"' is not exported from '../extensions/megapowers/subagent/pipeline-renderer.js'`

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  model?: string;
}

export interface StepEntry {
  step: StepName;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  error?: string;
}

export interface PipelineToolDetails {
  taskIndex: number;
  taskTitle: string;
  pipelineId: string;
  status: "running" | "completed" | "paused" | "failed";
  steps: StepEntry[];
  retryCount: number;
  usageStats: {
    perStep: Partial<Record<StepName, UsageStats>>;
    total: UsageStats;
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "PipelineToolDetails type"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Implement extractUsageStats function [depends: 6]

### Task 7: Implement extractUsageStats function [depends: 6]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
import {
  extractUsageStats,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";
import type { Message } from "@mariozechner/pi-ai";

describe("extractUsageStats", () => {
  it("extracts aggregate token counts, cost, and model from Message[]", () => {
    const messages: Message[] = [
      {
        role: "user",
        content: "hello",
        timestamp: 1,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "response 1" }],
        api: "anthropic-messages",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        usage: {
          input: 100,
          output: 50,
          cacheRead: 200,
          cacheWrite: 10,
          totalTokens: 360,
          cost: { input: 0.01, output: 0.02, cacheRead: 0.005, cacheWrite: 0.001, total: 0.036 },
        },
        stopReason: "stop",
        timestamp: 2,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "response 2" }],
        api: "anthropic-messages",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        usage: {
          input: 150,
          output: 60,
          cacheRead: 100,
          cacheWrite: 5,
          totalTokens: 315,
          cost: { input: 0.015, output: 0.03, cacheRead: 0.002, cacheWrite: 0.0005, total: 0.0475 },
        },
        stopReason: "stop",
        timestamp: 3,
      },
    ] as any;

    const stats = extractUsageStats(messages);

    expect(stats.input).toBe(250);
    expect(stats.output).toBe(110);
    expect(stats.cacheRead).toBe(300);
    expect(stats.cacheWrite).toBe(15);
    expect(stats.cost).toBeCloseTo(0.0835, 4);
    expect(stats.model).toBe("claude-sonnet-4-20250514");
  });

  it("returns zero stats for empty messages", () => {
    const stats = extractUsageStats([]);

    expect(stats.input).toBe(0);
    expect(stats.output).toBe(0);
    expect(stats.cacheRead).toBe(0);
    expect(stats.cacheWrite).toBe(0);
    expect(stats.cost).toBe(0);
    expect(stats.model).toBeUndefined();
  });

  it("handles messages without usage (user, toolResult)", () => {
    const messages: Message[] = [
      { role: "user", content: "test", timestamp: 1 },
      { role: "toolResult", toolCallId: "1", toolName: "bash", content: [{ type: "text", text: "ok" }], isError: false, timestamp: 2 },
    ] as any;

    const stats = extractUsageStats(messages);
    expect(stats.input).toBe(0);
    expect(stats.cost).toBe(0);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "extractUsageStats"`
Expected: FAIL — `extractUsageStats is not a function` or `is not exported`

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
export function extractUsageStats(messages: Message[]): UsageStats {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;
  let model: string | undefined;

  for (const msg of messages as any[]) {
    if (msg?.role !== "assistant") continue;
    const usage = msg?.usage;
    if (!usage) continue;

    input += usage.input || 0;
    output += usage.output || 0;
    cacheRead += usage.cacheRead || 0;
    cacheWrite += usage.cacheWrite || 0;
    cost += usage.cost?.total || 0;

    if (!model && msg.model) model = msg.model;
  }

  return { input, output, cacheRead, cacheWrite, cost, model };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "extractUsageStats"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: Implement buildPipelineDetails function [depends: 6, 7]

### Task 8: Implement buildPipelineDetails function [depends: 6, 7]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
import {
  buildPipelineDetails,
  extractUsageStats,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";
import type {
  PipelineProgressEvent,
  PipelineToolDetails,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

describe("buildPipelineDetails", () => {
  const meta = { taskIndex: 1, taskTitle: "Implement parser", pipelineId: "pipe-t1-123" };

  it("returns running status with no events", () => {
    const details = buildPipelineDetails([], meta);
    expect(details.taskIndex).toBe(1);
    expect(details.taskTitle).toBe("Implement parser");
    expect(details.pipelineId).toBe("pipe-t1-123");
    expect(details.status).toBe("running");
    expect(details.steps).toEqual([]);
    expect(details.retryCount).toBe(0);
  });

  it("accumulates step-start as running step", () => {
    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
    ];
    const details = buildPipelineDetails(events, meta);
    expect(details.steps).toHaveLength(1);
    expect(details.steps[0].step).toBe("implement");
    expect(details.steps[0].status).toBe("running");
    expect(details.status).toBe("running");
  });

  it("accumulates step-end as completed step", () => {
    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 5000 },
    ];
    const details = buildPipelineDetails(events, meta);
    expect(details.steps).toHaveLength(1);
    expect(details.steps[0].status).toBe("completed");
    expect(details.steps[0].durationMs).toBe(5000);
  });

  it("accumulates full happy path to completed", () => {
    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 5000, messages: [
        { role: "assistant", content: [{ type: "text", text: "done" }], usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 } }, model: "claude-sonnet-4-20250514" } as any,
      ] },
      { type: "step-start", step: "verify" },
      { type: "step-end", step: "verify", durationMs: 2000 },
      { type: "step-start", step: "review" },
      { type: "step-end", step: "review", durationMs: 3000, messages: [
        { role: "assistant", content: [{ type: "text", text: "approved" }], usage: { input: 200, output: 30, cacheRead: 0, cacheWrite: 0, totalTokens: 230, cost: { input: 0.02, output: 0.01, cacheRead: 0, cacheWrite: 0, total: 0.03 } }, model: "claude-sonnet-4-20250514" } as any,
      ] },
    ];

    const details = buildPipelineDetails(events, meta);
    expect(details.status).toBe("completed");
    expect(details.steps).toHaveLength(3);
    expect(details.retryCount).toBe(0);

    // Usage stats per step
    expect(details.usageStats.perStep.implement?.input).toBe(100);
    expect(details.usageStats.perStep.review?.input).toBe(200);
    expect(details.usageStats.perStep.verify).toBeUndefined();

    // Total usage
    expect(details.usageStats.total.input).toBe(300);
    expect(details.usageStats.total.output).toBe(80);
    expect(details.usageStats.total.cost).toBeCloseTo(0.06, 4);
  });

  it("tracks retry count from retry events", () => {
    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 5000 },
      { type: "step-start", step: "verify" },
      { type: "step-end", step: "verify", durationMs: 1000, error: "tests failed" },
      { type: "retry", retryCount: 1, reason: "verify_failed" },
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 4000 },
      { type: "step-start", step: "verify" },
      { type: "step-end", step: "verify", durationMs: 1000 },
      { type: "step-start", step: "review" },
      { type: "step-end", step: "review", durationMs: 3000 },
    ];

    const details = buildPipelineDetails(events, meta);
    expect(details.retryCount).toBe(1);
    expect(details.status).toBe("completed");
    // Latest steps should reflect the final cycle
    expect(details.steps).toHaveLength(3);
  });

  it("marks step as failed when step-end has error", () => {
    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 5000, error: "timeout" },
    ];
    const details = buildPipelineDetails(events, meta);
    expect(details.steps[0].status).toBe("failed");
    expect(details.steps[0].error).toBe("timeout");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "buildPipelineDetails"`
Expected: FAIL — `buildPipelineDetails is not a function` or `is not exported`

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
export function buildPipelineDetails(
  events: PipelineProgressEvent[],
  meta: { taskIndex: number; taskTitle: string; pipelineId: string },
): PipelineToolDetails {
  let retryCount = 0;
  let steps: StepEntry[] = [];
  const perStep: Partial<Record<StepName, UsageStats>> = {};
  const totalUsage: UsageStats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };

  for (const event of events) {
    if (event.type === "step-start") {
      steps.push({ step: event.step, status: "running" });
    } else if (event.type === "step-end") {
      const existing = steps.find((s) => s.step === event.step && s.status === "running");
      if (existing) {
        existing.status = event.error ? "failed" : "completed";
        existing.durationMs = event.durationMs;
        existing.error = event.error;
      }

      // Extract usage from messages for LLM steps
      if (event.messages && event.messages.length > 0) {
        const stats = extractUsageStats(event.messages);
        perStep[event.step] = stats;
        totalUsage.input += stats.input;
        totalUsage.output += stats.output;
        totalUsage.cacheRead += stats.cacheRead;
        totalUsage.cacheWrite += stats.cacheWrite;
        totalUsage.cost += stats.cost;
        if (!totalUsage.model && stats.model) totalUsage.model = stats.model;
      }
    } else if (event.type === "retry") {
      retryCount = event.retryCount;
      // Reset steps for the new cycle
      steps = [];
    }
  }

  // Determine overall status
  let status: PipelineToolDetails["status"] = "running";
  const allStepNames: StepName[] = ["implement", "verify", "review"];
  const completedSteps = steps.filter((s) => s.status === "completed");
  if (completedSteps.length === 3 && allStepNames.every((name) => steps.some((s) => s.step === name && s.status === "completed"))) {
    status = "completed";
  } else if (steps.some((s) => s.status === "failed")) {
    // Could be paused or failed depending on context, but from events alone we say "running"
    // until we know the pipeline stopped
    status = "running";
  }

  return {
    taskIndex: meta.taskIndex,
    taskTitle: meta.taskTitle,
    pipelineId: meta.pipelineId,
    status,
    steps,
    retryCount,
    usageStats: { perStep, total: totalUsage },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "buildPipelineDetails"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: Implement renderPipelineCall function [depends: 1]

### Task 9: Implement renderPipelineCall function [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
import {
  renderPipelineCall,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

// Create a minimal mock theme that returns plain text (no ANSI)
const mockTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as any;

// Helper to extract text from a TUI component
function renderToString(component: any): string {
  return component.render(120).join("\n");
}

describe("renderPipelineCall", () => {
  it("renders task index for a fresh pipeline run", () => {
    const result = renderPipelineCall({ taskIndex: 3 }, mockTheme);
    const text = renderToString(result);
    expect(text).toContain("pipeline");
    expect(text).toContain("3");
  });

  it("renders resume info when resume is true", () => {
    const result = renderPipelineCall(
      { taskIndex: 2, resume: true, guidance: "Fix the failing test" },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("resume");
    expect(text).toContain("2");
  });

  it("renders without resume indicator when not resuming", () => {
    const result = renderPipelineCall({ taskIndex: 1 }, mockTheme);
    const text = renderToString(result);
    expect(text).not.toContain("resume");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineCall"`
Expected: FAIL — `renderPipelineCall is not a function` or `is not exported`

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
import { Text } from "@mariozechner/pi-tui";

export function renderPipelineCall(
  args: { taskIndex: number; resume?: boolean; guidance?: string },
  theme: any,
): InstanceType<typeof Text> {
  let text = theme.fg("toolTitle", theme.bold("pipeline "));
  text += theme.fg("accent", `task ${args.taskIndex}`);

  if (args.resume) {
    text += theme.fg("warning", " (resume)");
    if (args.guidance) {
      const preview = args.guidance.length > 60 ? `${args.guidance.slice(0, 60)}...` : args.guidance;
      text += "\n  " + theme.fg("dim", preview);
    }
  }

  return new Text(text, 0, 0);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineCall"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 10: Implement renderPipelineResult collapsed mode [depends: 6, 9]

### Task 10: Implement renderPipelineResult collapsed mode [depends: 6, 9]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
import {
  renderPipelineResult,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";
import type {
  PipelineToolDetails,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

describe("renderPipelineResult — collapsed mode", () => {
  it("shows one-line summary with checkmark for completed pipeline", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "completed",
      steps: [
        { step: "implement", status: "completed", durationMs: 5000 },
        { step: "verify", status: "completed", durationMs: 2000 },
        { step: "review", status: "completed", durationMs: 3000 },
      ],
      retryCount: 0,
      usageStats: {
        perStep: {},
        total: { input: 300, output: 80, cacheRead: 0, cacheWrite: 0, cost: 0.06 },
      },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "done" }], details },
      { expanded: false, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("✓");
    expect(text).toContain("3");  // 3 steps
    expect(text).toContain("$0.06");
  });

  it("shows failure icon for paused pipeline", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "paused",
      steps: [
        { step: "implement", status: "completed", durationMs: 5000 },
        { step: "verify", status: "failed", durationMs: 1000, error: "tests failed" },
      ],
      retryCount: 2,
      usageStats: { perStep: {}, total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 } },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "paused" }], details },
      { expanded: false, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("⏸");
  });

  it("shows running indicator when isPartial is true", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "running",
      steps: [
        { step: "implement", status: "running" },
      ],
      retryCount: 0,
      usageStats: { perStep: {}, total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 } },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "" }], details },
      { expanded: false, isPartial: true },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("implement");
  });

  it("shows failed icon for failed pipeline", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "failed",
      steps: [
        { step: "implement", status: "failed", durationMs: 1000, error: "timeout" },
      ],
      retryCount: 0,
      usageStats: { perStep: {}, total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 } },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "error" }], details },
      { expanded: false, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("✗");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineResult — collapsed"`
Expected: FAIL — `renderPipelineResult is not a function` or `is not exported`

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
import { Container } from "@mariozechner/pi-tui";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "";
  return `$${cost.toFixed(4)}`;
}

export function renderPipelineResult(
  result: AgentToolResult<PipelineToolDetails>,
  options: { expanded: boolean; isPartial: boolean },
  theme: any,
): InstanceType<typeof Text> | InstanceType<typeof Container> {
  const details = result.details;

  if (!details) {
    const content = result.content[0];
    return new Text(content?.type === "text" ? content.text : "(no output)", 0, 0);
  }

  if (options.isPartial) {
    return renderPartialPipeline(details, theme);
  }

  if (options.expanded) {
    return renderExpandedPipeline(details, theme);
  }

  return renderCollapsedPipeline(details, theme);
}

function renderPartialPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Text> {
  const runningStep = details.steps.find((s) => s.status === "running");
  const completedCount = details.steps.filter((s) => s.status === "completed").length;

  let text = theme.fg("warning", "⏳ ");
  text += theme.fg("toolTitle", theme.bold("pipeline "));
  text += theme.fg("accent", `task ${details.taskIndex}`);

  if (runningStep) {
    text += theme.fg("dim", ` — ${runningStep.step}`);
  }
  if (completedCount > 0) {
    text += theme.fg("muted", ` (${completedCount}/3 steps done)`);
  }
  if (details.retryCount > 0) {
    text += theme.fg("warning", ` retry ${details.retryCount}`);
  }

  return new Text(text, 0, 0);
}

function renderCollapsedPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Text> {
  const statusIcon =
    details.status === "completed" ? theme.fg("success", "✓") :
    details.status === "paused" ? theme.fg("warning", "⏸") :
    details.status === "failed" ? theme.fg("error", "✗") :
    theme.fg("warning", "⏳");

  const stepCount = details.steps.length;
  const totalDuration = details.steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const costStr = formatCost(details.usageStats.total.cost);

  let text = `${statusIcon} `;
  text += theme.fg("toolTitle", theme.bold("pipeline "));
  text += theme.fg("accent", `task ${details.taskIndex}`);
  text += theme.fg("dim", ` — ${stepCount} steps`);
  if (totalDuration > 0) text += theme.fg("dim", `, ${formatDuration(totalDuration)}`);
  if (costStr) text += theme.fg("dim", `, ${costStr}`);
  if (details.retryCount > 0) text += theme.fg("warning", ` (${details.retryCount} retries)`);

  return new Text(text, 0, 0);
}

function renderExpandedPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Container> {
  // Placeholder — implemented in next task
  const container = new Container();
  container.addChild(new Text(renderCollapsedPipeline(details, theme).render(120).join("\n"), 0, 0));
  return container;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineResult — collapsed"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Implement renderPipelineResult expanded mode [depends: 10]

### Task 11: Implement renderPipelineResult expanded mode [depends: 10]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
describe("renderPipelineResult — expanded mode", () => {
  it("shows all steps with individual status icons and durations", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "completed",
      steps: [
        { step: "implement", status: "completed", durationMs: 5000 },
        { step: "verify", status: "completed", durationMs: 2000 },
        { step: "review", status: "completed", durationMs: 3000 },
      ],
      retryCount: 0,
      usageStats: {
        perStep: {
          implement: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.03, model: "claude-sonnet-4-20250514" },
          review: { input: 200, output: 30, cacheRead: 0, cacheWrite: 0, cost: 0.03, model: "claude-sonnet-4-20250514" },
        },
        total: { input: 300, output: 80, cacheRead: 0, cacheWrite: 0, cost: 0.06, model: "claude-sonnet-4-20250514" },
      },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "done" }], details },
      { expanded: true, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);

    // All steps shown with icons
    expect(text).toContain("implement");
    expect(text).toContain("verify");
    expect(text).toContain("review");

    // Individual durations
    expect(text).toContain("5.0s");
    expect(text).toContain("2.0s");
    expect(text).toContain("3.0s");

    // Per-step usage for LLM steps
    expect(text).toContain("100"); // implement input tokens
    expect(text).toContain("200"); // review input tokens

    // Total usage
    expect(text).toContain("$0.06");
  });

  it("shows errors for failed steps", () => {
    const details: PipelineToolDetails = {
      taskIndex: 2,
      taskTitle: "Add validation",
      pipelineId: "pipe-t2-456",
      status: "paused",
      steps: [
        { step: "implement", status: "completed", durationMs: 5000 },
        { step: "verify", status: "failed", durationMs: 1000, error: "exit code 1" },
      ],
      retryCount: 2,
      usageStats: {
        perStep: {
          implement: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.03 },
        },
        total: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.03 },
      },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "paused" }], details },
      { expanded: true, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);

    expect(text).toContain("✗");  // failed step icon
    expect(text).toContain("exit code 1");  // error shown
    expect(text).toContain("2");  // retry count
  });

  it("shows retry count in expanded view", () => {
    const details: PipelineToolDetails = {
      taskIndex: 1,
      taskTitle: "Implement parser",
      pipelineId: "pipe-t1-123",
      status: "completed",
      steps: [
        { step: "implement", status: "completed", durationMs: 5000 },
        { step: "verify", status: "completed", durationMs: 2000 },
        { step: "review", status: "completed", durationMs: 3000 },
      ],
      retryCount: 1,
      usageStats: {
        perStep: {},
        total: { input: 300, output: 80, cacheRead: 0, cacheWrite: 0, cost: 0.06 },
      },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "done" }], details },
      { expanded: true, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("1");  // retry count shown
    expect(text).toContain("retr");  // "retry" or "retries"
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineResult — expanded"`
Expected: FAIL — The placeholder `renderExpandedPipeline` from Task 10 just delegates to collapsed view, so it won't show individual step details, per-step usage, or errors.

**Step 3 — Write minimal implementation**

Replace the `renderExpandedPipeline` function in `extensions/megapowers/subagent/pipeline-renderer.ts`:

```typescript
import { Container, Spacer } from "@mariozechner/pi-tui";

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageOneLiner(stats: UsageStats): string {
  const parts: string[] = [];
  if (stats.input) parts.push(`↑${formatTokens(stats.input)}`);
  if (stats.output) parts.push(`↓${formatTokens(stats.output)}`);
  if (stats.cacheRead) parts.push(`R${formatTokens(stats.cacheRead)}`);
  if (stats.cacheWrite) parts.push(`W${formatTokens(stats.cacheWrite)}`);
  if (stats.cost) parts.push(`$${stats.cost.toFixed(4)}`);
  if (stats.model) parts.push(stats.model);
  return parts.join(" ");
}

function renderExpandedPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Container> {
  const container = new Container();

  // Header
  const statusIcon =
    details.status === "completed" ? theme.fg("success", "✓") :
    details.status === "paused" ? theme.fg("warning", "⏸") :
    details.status === "failed" ? theme.fg("error", "✗") :
    theme.fg("warning", "⏳");

  let header = `${statusIcon} `;
  header += theme.fg("toolTitle", theme.bold("pipeline "));
  header += theme.fg("accent", `task ${details.taskIndex}`);
  if (details.retryCount > 0) {
    header += theme.fg("warning", ` (${details.retryCount} ${details.retryCount === 1 ? "retry" : "retries"})`);
  }
  container.addChild(new Text(header, 0, 0));

  // Steps
  for (const step of details.steps) {
    const icon =
      step.status === "completed" ? theme.fg("success", "✓") :
      step.status === "failed" ? theme.fg("error", "✗") :
      theme.fg("warning", "⏳");

    let line = `  ${icon} ${theme.fg("accent", step.step)}`;
    if (step.durationMs !== undefined) {
      line += theme.fg("dim", ` ${formatDuration(step.durationMs)}`);
    }
    if (step.error) {
      line += theme.fg("error", ` — ${step.error}`);
    }
    container.addChild(new Text(line, 0, 0));

    // Per-step usage for LLM steps
    const stepUsage = details.usageStats.perStep[step.step];
    if (stepUsage) {
      const usageStr = formatUsageOneLiner(stepUsage);
      if (usageStr) {
        container.addChild(new Text(`    ${theme.fg("dim", usageStr)}`, 0, 0));
      }
    }
  }

  // Total usage
  const totalStr = formatUsageOneLiner(details.usageStats.total);
  if (totalStr) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", `Total: ${totalStr}`), 0, 0));
  }

  return container;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineResult — expanded"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 12: Wire renderCall and renderResult into pipeline tool registration [depends: 9, 10, 11]

### Task 12: Wire renderCall and renderResult into pipeline tool registration [depends: 9, 10, 11]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**

Add to `tests/register-tools.test.ts`:
```typescript
  it("pipeline tool registration includes renderCall and renderResult", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    const pipeline = tools.pipeline;
    expect(pipeline).toBeDefined();
    expect(typeof pipeline.renderCall).toBe("function");
    expect(typeof pipeline.renderResult).toBe("function");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool registration includes renderCall"`
Expected: FAIL — `expect(received).toBe(expected)` — `typeof pipeline.renderCall` is `"undefined"`, expected `"function"`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, add the import at the top:
```typescript
import { renderPipelineCall, renderPipelineResult } from "./subagent/pipeline-renderer.js";
```

In the pipeline tool registration (around line 188), add `renderCall` and `renderResult` properties to the object passed to `pi.registerTool({...})`:

```typescript
    renderCall(args, theme) {
      return renderPipelineCall(args, theme);
    },

    renderResult(result, options, theme) {
      return renderPipelineResult(result as any, options, theme);
    },
```

These go after the `parameters` property and before the `execute` method in the pipeline tool registration object.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool registration includes renderCall"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 13: Wire onProgress to onUpdate in pipeline tool handler [depends: 8, 12]

### Task 13: Wire onProgress to onUpdate in pipeline tool handler [depends: 8, 12]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**

Add to `tests/register-tools.test.ts`:
```typescript
  it("pipeline tool handler passes onProgress to handlePipelineTool options", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
    // The pipeline tool execute function should reference onProgress and onUpdate
    expect(source).toContain("onProgress");
    expect(source).toContain("onUpdate");
    expect(source).toContain("buildPipelineDetails");
  });
```

Additionally, add a structural test to verify the wiring exists in `pipeline-tool.ts`:

Add to a new test file or extend `tests/pipeline-tool.test.ts`:
```typescript
// In tests/pipeline-tool.test.ts, add:
  it("handlePipelineTool passes onProgress from options to runPipeline", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/subagent/pipeline-tool.ts"), "utf-8");
    expect(source).toContain("onProgress");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool handler passes onProgress"`
Expected: FAIL — `expect(received).toContain(expected)` — "onProgress" not found in register-tools.ts source.

**Step 3 — Write minimal implementation**

**Modify `extensions/megapowers/subagent/pipeline-tool.ts`:**

Add the import:
```typescript
import type { PipelineProgressEvent } from "./pipeline-renderer.js";
```

Update `handlePipelineTool` signature to accept an optional `onProgress` callback:
```typescript
export async function handlePipelineTool(
  projectRoot: string,
  input: PipelineToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
  execShell?: ExecShell,
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<PipelineToolOutput> {
```

And pass it through to `runPipeline` options (around line 111-118):
```typescript
  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      projectRoot,
      workspaceCwd: workspacePath,
      pipelineId,
      agents: { implementer: "implementer", reviewer: "reviewer" },
      execGit,
      execShell,
      onProgress,
    },
  );
```

**Modify `extensions/megapowers/register-tools.ts`:**

Add imports:
```typescript
import { renderPipelineCall, renderPipelineResult, buildPipelineDetails } from "./subagent/pipeline-renderer.js";
import type { PipelineProgressEvent, PipelineToolDetails } from "./subagent/pipeline-renderer.js";
```

In the pipeline tool's `execute` function, wire up `onProgress` → `onUpdate`:
```typescript
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const execGit = async (args: string[]) => {
        const r = await pi.exec("git", args);
        if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
        return { stdout: r.stdout, stderr: r.stderr };
      };

      const { discoverAgents } = await import("pi-subagents/agents.js");
      const { runSync } = await import("pi-subagents/execution.js");
      const { agents } = discoverAgents(ctx.cwd, "both");
      const dispatcher = new PiSubagentsDispatcher({ runSync, runtimeCwd: ctx.cwd, agents });

      // Wire onProgress → onUpdate for live TUI rendering
      const progressEvents: PipelineProgressEvent[] = [];
      const taskTitle = `Task ${params.taskIndex}`;
      const pipelineId = `pipe-t${params.taskIndex}`;

      const onProgress = onUpdate
        ? (event: PipelineProgressEvent) => {
            progressEvents.push(event);
            const details = buildPipelineDetails(progressEvents, {
              taskIndex: params.taskIndex,
              taskTitle,
              pipelineId,
            });
            onUpdate({
              content: [{ type: "text", text: `Pipeline ${details.status}...` }],
              details: details as any,
            });
          }
        : undefined;

      const r = await handlePipelineTool(
        ctx.cwd,
        { taskIndex: params.taskIndex, resume: params.resume, guidance: params.guidance },
        dispatcher,
        execGit,
        undefined,
        onProgress,
      );

      if (r.error) return { content: [{ type: "text", text: `Error: ${r.error}` }], details: undefined };

      // Build final details for the result
      const finalDetails = buildPipelineDetails(progressEvents, {
        taskIndex: params.taskIndex,
        taskTitle,
        pipelineId: r.pipelineId ?? pipelineId,
      });
      // Update status based on actual result
      if (r.result?.status === "completed") finalDetails.status = "completed";
      else if (r.paused) finalDetails.status = "paused";

      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], details: finalDetails as any };
    },
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool handler passes onProgress"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 14: Verify all renderer functions are pure and exported from pipeline-renderer.ts [depends: 11, 8]

### Task 14: Verify all renderer functions are pure and exported from pipeline-renderer.ts [depends: 11, 8]

**Files:**
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
describe("pipeline-renderer module exports (AC15)", () => {
  it("exports all required functions and types from a single module", async () => {
    const mod = await import("../extensions/megapowers/subagent/pipeline-renderer.js");

    // Functions
    expect(typeof mod.renderPipelineCall).toBe("function");
    expect(typeof mod.renderPipelineResult).toBe("function");
    expect(typeof mod.buildPipelineDetails).toBe("function");
    expect(typeof mod.extractUsageStats).toBe("function");
  });

  it("renderPipelineCall is pure — same input produces same output", () => {
    const args = { taskIndex: 1 };
    const result1 = renderPipelineCall(args, mockTheme);
    const result2 = renderPipelineCall(args, mockTheme);
    const text1 = renderToString(result1);
    const text2 = renderToString(result2);
    expect(text1).toBe(text2);
  });

  it("buildPipelineDetails is pure — same input produces same output", () => {
    const meta = { taskIndex: 1, taskTitle: "Test", pipelineId: "p1" };
    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 1000 },
    ];
    const result1 = buildPipelineDetails(events, meta);
    const result2 = buildPipelineDetails(events, meta);
    expect(result1).toEqual(result2);
  });

  it("extractUsageStats is pure — same input produces same output", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "ok" }],
        usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 } },
        model: "test-model",
      },
    ] as any;
    const result1 = extractUsageStats(messages);
    const result2 = extractUsageStats(messages);
    expect(result1).toEqual(result2);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "pipeline-renderer module exports"`
Expected: PASS — all functions should already be exported and pure from previous tasks. This test codifies AC15.

**Step 3 — Write minimal implementation**

No implementation changes needed. This test validates that the module contract from AC15 is satisfied.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "pipeline-renderer module exports"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
