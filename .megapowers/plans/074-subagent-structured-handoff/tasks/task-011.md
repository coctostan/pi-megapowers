---
id: 11
title: Implement renderPipelineResult expanded mode
status: approved
depends_on:
  - 10
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

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
