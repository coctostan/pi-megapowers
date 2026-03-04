---
id: 10
title: Implement renderPipelineResult collapsed mode
status: approved
depends_on:
  - 6
  - 9
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

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
