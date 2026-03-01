import { describe, it, expect } from "bun:test";
import { registerTools } from "../extensions/megapowers/register-tools.js";

describe("registerTools", () => {
  it("does not register megapowers_save_artifact (AC1)", () => {
    const registered: string[] = [];

    const pi = {
      registerTool: (tool: any) => {
        registered.push(tool.name);
      },
    } as any;

    registerTools(pi, {} as any);

    expect(registered).toContain("megapowers_signal");
    expect(registered).not.toContain("megapowers_save_artifact");
  });
});
