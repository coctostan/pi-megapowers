import type { Message } from "@mariozechner/pi-ai";
import { Container, Spacer, Text } from "@mariozechner/pi-tui";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

export type StepName = "implement" | "verify" | "review";

export type PipelineProgressEvent =
  | { type: "step-start"; step: StepName }
  | {
      type: "step-end";
      step: StepName;
      durationMs: number;
      error?: string;
      messages?: Message[];
    }
  | { type: "retry"; retryCount: number; reason: string };

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

      if (event.messages && event.messages.length > 0) {
        const stats = extractUsageStats(event.messages);
        const prev = perStep[event.step];
        perStep[event.step] = prev
          ? {
              input: prev.input + stats.input,
              output: prev.output + stats.output,
              cacheRead: prev.cacheRead + stats.cacheRead,
              cacheWrite: prev.cacheWrite + stats.cacheWrite,
              cost: prev.cost + stats.cost,
              model: prev.model ?? stats.model,
            }
          : stats;
        totalUsage.input += stats.input;
        totalUsage.output += stats.output;
        totalUsage.cacheRead += stats.cacheRead;
        totalUsage.cacheWrite += stats.cacheWrite;
        totalUsage.cost += stats.cost;
        if (!totalUsage.model && stats.model) totalUsage.model = stats.model;
      }
    } else if (event.type === "retry") {
      retryCount = event.retryCount;
      steps = [];
    }
  }

  let status: PipelineToolDetails["status"] = "running";
  const allStepNames: StepName[] = ["implement", "verify", "review"];
  const completedSteps = steps.filter((s) => s.status === "completed");
  if (
    completedSteps.length === 3 &&
    allStepNames.every((name) => steps.some((s) => s.step === name && s.status === "completed"))
  ) {
    status = "completed";
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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "";
  return `$${cost.toFixed(4)}`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export function formatUsageOneLiner(stats: UsageStats): string {
  const parts: string[] = [];
  if (stats.input) parts.push(`↑${formatTokens(stats.input)}`);
  if (stats.output) parts.push(`↓${formatTokens(stats.output)}`);
  if (stats.cacheRead) parts.push(`R${formatTokens(stats.cacheRead)}`);
  if (stats.cacheWrite) parts.push(`W${formatTokens(stats.cacheWrite)}`);
  if (stats.cost) parts.push(`$${stats.cost.toFixed(4)}`);
  if (stats.model) parts.push(stats.model);
  return parts.join(" ");
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

export function renderPartialPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Text> {
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

export function renderCollapsedPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Text> {
  const statusIcon =
    details.status === "completed"
      ? theme.fg("success", "✓")
      : details.status === "paused"
        ? theme.fg("warning", "⏸")
        : details.status === "failed"
          ? theme.fg("error", "✗")
          : theme.fg("warning", "⏳");

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

export function renderExpandedPipeline(details: PipelineToolDetails, theme: any): InstanceType<typeof Container> {
  const container = new Container();
  const statusIcon =
    details.status === "completed"
      ? theme.fg("success", "✓")
      : details.status === "paused"
        ? theme.fg("warning", "⏸")
        : details.status === "failed"
          ? theme.fg("error", "✗")
          : theme.fg("warning", "⏳");

  let header = `${statusIcon} `;
  header += theme.fg("toolTitle", theme.bold("pipeline "));
  header += theme.fg("accent", `task ${details.taskIndex}`);
  if (details.retryCount > 0) {
    header += theme.fg("warning", ` (${details.retryCount} ${details.retryCount === 1 ? "retry" : "retries"})`);
  }
  container.addChild(new Text(header, 0, 0));

  for (const step of details.steps) {
    const icon =
      step.status === "completed"
        ? theme.fg("success", "✓")
        : step.status === "failed"
          ? theme.fg("error", "✗")
          : theme.fg("warning", "⏳");

    let line = `  ${icon} ${theme.fg("accent", step.step)}`;
    if (step.durationMs !== undefined) {
      line += theme.fg("dim", ` ${formatDuration(step.durationMs)}`);
    }
    if (step.error) {
      line += theme.fg("error", ` — ${step.error}`);
    }
    container.addChild(new Text(line, 0, 0));

    const stepUsage = details.usageStats.perStep[step.step];
    if (stepUsage) {
      const usageStr = formatUsageOneLiner(stepUsage);
      if (usageStr) {
        container.addChild(new Text(`    ${theme.fg("dim", usageStr)}`, 0, 0));
      }
    }
  }

  const totalStr = formatUsageOneLiner(details.usageStats.total);
  if (totalStr) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", `Total: ${totalStr}`), 0, 0));
  }
  return container;
}