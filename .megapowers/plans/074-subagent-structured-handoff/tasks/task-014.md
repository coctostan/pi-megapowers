---
id: 14
title: Verify all renderer functions are pure and exported from pipeline-renderer.ts
status: approved
depends_on:
  - 11
  - 8
no_test: false
files_to_modify:
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

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
