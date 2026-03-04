---
id: 8
title: Implement buildPipelineDetails function
status: approved
depends_on:
  - 6
  - 7
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

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
