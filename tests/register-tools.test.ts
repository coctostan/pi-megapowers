import { describe, it, expect } from "bun:test";
import { registerTools } from "../extensions/megapowers/register-tools.js";

describe("registerTools — plan loop tools", () => {
  it("registers plan loop tools and extends megapowers_signal actions", () => {
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
    expect(Object.keys(tools)).not.toContain("megapowers_save_artifact");

    const signalParams = JSON.stringify(tools.megapowers_signal.parameters);
    expect(signalParams).toContain("plan_draft_done");
  });
});
