---
id: 6
title: Define PipelineToolDetails type
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

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
