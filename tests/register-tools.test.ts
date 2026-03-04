import { describe, it, expect } from "bun:test";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it("register-tools uses git exec for subagent and pipeline tools", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
    expect(source).toContain('pi.exec("git"');
    expect(source).not.toContain('pi.exec("jj"');
    expect(source).toContain("isolated workspace");
    expect(source).not.toContain("isolated jj workspace");
  });

  it("execGit in register-tools throws on non-zero exit (no legacy code field in return)", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
    // The ExecGit executor must throw on error, not return { code }
    expect(source).toContain("throw new Error");
    // No return statement that includes 'code:' (which would trigger legacy compat branches)
    expect(source).not.toMatch(/return \{ code: r\.code/);
  });

  it("pipeline tool registration includes renderCall and renderResult", () => {
    const tools: Record<string, any> = {};

    const pi = {
      registerTool: (tool: any) => {
        tools[tool.name] = tool;
      },
    } as any;

    registerTools(pi, {} as any);

    const pipeline = tools.pipeline;
    expect(pipeline).toBeDefined();
    expect(typeof pipeline.renderCall).toBe("function");
    expect(typeof pipeline.renderResult).toBe("function");
  });

  it("pipeline tool handler passes onProgress to handlePipelineTool options", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
    // The pipeline tool execute function should reference onProgress and onUpdate
    expect(source).toContain("onProgress");
    expect(source).toContain("onUpdate");
    expect(source).toContain("buildPipelineDetails");
  });
});
