import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";
import { registerTools } from "../extensions/megapowers/register-tools.js";

function extractText(result: any): string {
  const blocks = result?.content ?? [];
  return blocks.map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
}

describe("create_issue tool validation", () => {
  it("rejects missing title with a validation error message containing the failure (AC9)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "create-issue-validate-"));
    try {
      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => (tools[tool.name] = tool),
        exec: async () => ({ code: 0, stdout: "", stderr: "" }),
      } as any;

      const runtimeDeps = { store: createStore(tmp), ui: createUI() } as any;
      registerTools(pi, runtimeDeps);

      expect(tools.create_issue).toBeDefined();

      const ctx = { cwd: tmp, hasUI: false } as any;
      const res = await tools.create_issue.execute(
        "1",
        { type: "feature", description: "desc" },
        undefined,
        undefined,
        ctx,
      );
      const text = extractText(res).toLowerCase();

      expect(text).toContain("error");
      expect(text).toContain("title");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects invalid type with an error message (AC10)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "create-issue-validate2-"));
    try {
      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => (tools[tool.name] = tool),
        exec: async () => ({ code: 0, stdout: "", stderr: "" }),
      } as any;

      const runtimeDeps = { store: createStore(tmp), ui: createUI() } as any;
      registerTools(pi, runtimeDeps);

      const ctx = { cwd: tmp, hasUI: false } as any;
      const res = await tools.create_issue.execute(
        "1",
        { title: "T", type: "nope", description: "desc" },
        undefined,
        undefined,
        ctx,
      );
      const text = extractText(res).toLowerCase();

      expect(text).toContain("type");
      expect(text).toContain("feature");
      expect(text).toContain("bugfix");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
