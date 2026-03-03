import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

function extractText(result: any): string {
  const blocks = result?.content ?? [];
  return blocks.map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
}

describe("create_issue tool success", () => {
  it("creates the issue via store.createIssue and returns slug and id as JSON (AC11) and writes milestone/priority frontmatter (AC13-AC15)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "create-issue-success-"));
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
        {
          title: "My feature",
          type: "feature",
          description: "Do the thing",
          milestone: "M2",
          priority: 2,
          sources: [1, 2],
        },
        undefined,
        undefined,
        ctx,
      );
      const text = extractText(res);
      const parsed = JSON.parse(text);
      expect(typeof parsed.slug).toBe("string");
      expect(typeof parsed.id).toBe("number");
      expect(parsed.slug).toContain("my-feature");
      const issuePath = join(tmp, ".megapowers", "issues", `${parsed.slug}.md`);
      const content = readFileSync(issuePath, "utf-8");
      expect(content).toContain("milestone: M2");
      expect(content).toContain("priority: 2");
      expect(content).toContain("sources: [1, 2]");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
