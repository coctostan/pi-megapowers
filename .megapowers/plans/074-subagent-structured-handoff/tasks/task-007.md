---
id: 7
title: Implement extractUsageStats function
status: approved
depends_on:
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

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
