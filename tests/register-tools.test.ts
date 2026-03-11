import { describe, it, expect } from "bun:test";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("registerTools — legacy tool removal", () => {
  it("registers plan loop tools without pipeline or subagent", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    expect(Object.keys(tools)).toContain("megapowers_signal");
    expect(Object.keys(tools)).toContain("megapowers_plan_task");
    expect(Object.keys(tools)).toContain("megapowers_plan_review");
    expect(Object.keys(tools)).not.toContain("pipeline");
    expect(Object.keys(tools)).not.toContain("subagent");
  });

  it("megapowers_signal still exposes plan_draft_done", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    const signalParams = JSON.stringify(tools.megapowers_signal.parameters);
    expect(signalParams).toContain("plan_draft_done");
  });

  it("register-tools source no longer imports or wires legacy pipeline/subagent handlers", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");

    expect(source).not.toContain("handleOneshotTool");
    expect(source).not.toContain("handlePipelineTool");
    expect(source).not.toContain("PiSubagentsDispatcher");
    expect(source).not.toContain('name: "pipeline"');
    expect(source).not.toContain('name: "subagent"');
    expect(source).not.toContain("renderPipelineCall");
    expect(source).not.toContain("renderPipelineResult");
  });

  it("plan_draft_done wiring still calls handlePlanDraftDone directly", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");

    expect(source).toContain("result = await handlePlanDraftDone(ctx.cwd);");
  });
});
