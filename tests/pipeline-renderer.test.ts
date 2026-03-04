import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PipelineProgressEvent,
  PipelineToolDetails,
  StepName,
  StepEntry,
  UsageStats,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";
import "../extensions/megapowers/subagent/pipeline-renderer.js";
import { buildPipelineDetails, extractUsageStats, renderPipelineCall, renderPipelineResult } from "../extensions/megapowers/subagent/pipeline-renderer.js";
import type { Message } from "@mariozechner/pi-ai";

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


describe("PipelineToolDetails type", () => {
  it("declares and exports PipelineToolDetails-related interfaces", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/pipeline-renderer.ts"),
      "utf-8",
    );

    expect(source).toContain("export interface UsageStats");
    expect(source).toContain("export interface StepEntry");
    expect(source).toContain("export interface PipelineToolDetails");
  });
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
          cost: {
            input: 0.015,
            output: 0.03,
            cacheRead: 0.002,
            cacheWrite: 0.0005,
            total: 0.0475,
          },
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
      {
        role: "toolResult",
        toolCallId: "1",
        toolName: "bash",
        content: [{ type: "text", text: "ok" }],
        isError: false,
        timestamp: 2,
      },
    ] as any;

    const stats = extractUsageStats(messages);
    expect(stats.input).toBe(0);
    expect(stats.cost).toBe(0);
  });
});


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
    const events: PipelineProgressEvent[] = [{ type: "step-start", step: "implement" }];
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
      {
        type: "step-end",
        step: "implement",
        durationMs: 5000,
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "done" }],
            usage: {
              input: 100,
              output: 50,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 150,
              cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 },
            },
            model: "claude-sonnet-4-20250514",
          } as any,
        ],
      },
      { type: "step-start", step: "verify" },
      { type: "step-end", step: "verify", durationMs: 2000 },
      { type: "step-start", step: "review" },
      {
        type: "step-end",
        step: "review",
        durationMs: 3000,
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "approved" }],
            usage: {
              input: 200,
              output: 30,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 230,
              cost: { input: 0.02, output: 0.01, cacheRead: 0, cacheWrite: 0, total: 0.03 },
            },
            model: "claude-sonnet-4-20250514",
          } as any,
        ],
      },
    ];

    const details = buildPipelineDetails(events, meta);
    expect(details.status).toBe("completed");
    expect(details.steps).toHaveLength(3);
    expect(details.retryCount).toBe(0);

    expect(details.usageStats.perStep.implement?.input).toBe(100);
    expect(details.usageStats.perStep.review?.input).toBe(200);
    expect(details.usageStats.perStep.verify).toBeUndefined();

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

  it("accumulates perStep stats across retries so they are consistent with total", () => {
    const mkMsg = (input: number, output: number, cost: number) =>
      ({
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "ok" }],
        usage: {
          input,
          output,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: input + output,
          cost: { input: cost / 2, output: cost / 2, cacheRead: 0, cacheWrite: 0, total: cost },
        },
        model: "claude-test",
      } as any);

    const events: PipelineProgressEvent[] = [
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 5000, messages: [mkMsg(100, 50, 0.03)] },
      { type: "step-start", step: "verify" },
      { type: "step-end", step: "verify", durationMs: 1000, error: "tests failed" },
      { type: "retry", retryCount: 1, reason: "verify_failed" },
      { type: "step-start", step: "implement" },
      { type: "step-end", step: "implement", durationMs: 4000, messages: [mkMsg(80, 40, 0.02)] },
      { type: "step-start", step: "verify" },
      { type: "step-end", step: "verify", durationMs: 1000 },
      { type: "step-start", step: "review" },
      { type: "step-end", step: "review", durationMs: 3000, messages: [mkMsg(200, 30, 0.04)] },
    ];

    const details = buildPipelineDetails(events, meta);

    // perStep.implement should include stats from both retry runs
    expect(details.usageStats.perStep.implement?.input).toBe(180); // 100 + 80
    expect(details.usageStats.perStep.implement?.output).toBe(90); // 50 + 40
    expect(details.usageStats.perStep.implement?.cost).toBeCloseTo(0.05, 4); // 0.03 + 0.02
    expect(details.usageStats.perStep.review?.input).toBe(200);

    // total must equal sum of all perStep
    expect(details.usageStats.total.input).toBe(380); // 100 + 80 + 200
    expect(details.usageStats.total.output).toBe(120); // 50 + 40 + 30
    expect(details.usageStats.total.cost).toBeCloseTo(0.09, 4); // 0.03 + 0.02 + 0.04
  });
});

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
      { content: [{ type: "text", text: "done" }], details } as any,
      { expanded: false, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("✓");
    expect(text).toContain("3");
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
      { content: [{ type: "text", text: "paused" }], details } as any,
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
      steps: [{ step: "implement", status: "running" }],
      retryCount: 0,
      usageStats: { perStep: {}, total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 } },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "" }], details } as any,
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
      steps: [{ step: "implement", status: "failed", durationMs: 1000, error: "timeout" }],
      retryCount: 0,
      usageStats: { perStep: {}, total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 } },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "error" }], details } as any,
      { expanded: false, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("✗");
  });
});


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
          implement: {
            input: 100,
            output: 50,
            cacheRead: 0,
            cacheWrite: 0,
            cost: 0.03,
            model: "claude-sonnet-4-20250514",
          },
          review: {
            input: 200,
            output: 30,
            cacheRead: 0,
            cacheWrite: 0,
            cost: 0.03,
            model: "claude-sonnet-4-20250514",
          },
        },
        total: {
          input: 300,
          output: 80,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.06,
          model: "claude-sonnet-4-20250514",
        },
      },
    };

    const result = renderPipelineResult(
      { content: [{ type: "text", text: "done" }], details } as any,
      { expanded: true, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);

    expect(text).toContain("implement");
    expect(text).toContain("verify");
    expect(text).toContain("review");

    expect(text).toContain("5.0s");
    expect(text).toContain("2.0s");
    expect(text).toContain("3.0s");

    expect(text).toContain("100");
    expect(text).toContain("200");

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
      { content: [{ type: "text", text: "paused" }], details } as any,
      { expanded: true, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);

    expect(text).toContain("✗");
    expect(text).toContain("exit code 1");
    expect(text).toContain("2");
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
      { content: [{ type: "text", text: "done" }], details } as any,
      { expanded: true, isPartial: false },
      mockTheme,
    );
    const text = renderToString(result);

    expect(text).toContain("1");
    expect(text).toContain("retr");
  });
});


describe("pipeline-renderer module exports (AC15)", () => {
  it("exports all required functions and types from a single module", async () => {
    const mod = await import("../extensions/megapowers/subagent/pipeline-renderer.js");

    expect(typeof mod.renderPipelineCall).toBe("function");
    expect(typeof mod.renderPipelineResult).toBe("function");
    expect(typeof mod.buildPipelineDetails).toBe("function");
    expect(typeof mod.extractUsageStats).toBe("function");
    expect(typeof mod.renderPartialPipeline).toBe("function");
    expect(typeof mod.renderCollapsedPipeline).toBe("function");
    expect(typeof mod.renderExpandedPipeline).toBe("function");
    expect(typeof mod.formatDuration).toBe("function");
    expect(typeof mod.formatCost).toBe("function");
    expect(typeof mod.formatTokens).toBe("function");
    expect(typeof mod.formatUsageOneLiner).toBe("function");
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
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 150,
          cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 },
        },
        model: "test-model",
      },
    ] as any;

    const result1 = extractUsageStats(messages);
    const result2 = extractUsageStats(messages);

    expect(result1).toEqual(result2);
  });
});