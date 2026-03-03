---
id: 8
title: Implement create_issue tool success path (calls store.createIssue and
  returns slug/id; milestone/priority written)
status: approved
depends_on:
  - 5
  - 7
no_test: false
files_to_modify: []
files_to_create:
  - tests/create-issue-tool-success.test.ts
---

### Task 8: Implement create_issue tool success path (calls store.createIssue and returns slug/id; milestone/priority written)

**Files:**
- Test: `tests/create-issue-tool-success.test.ts`

**Step 1 — Write the failing test**
Create `tests/create-issue-tool-success.test.ts`:
```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/create-issue-tool-success.test.ts`
Expected: FAIL — `expect(tools.create_issue).toBeDefined()` passes, but `JSON.parse(text)` succeeds (Task 7 already returns JSON). The actual failure will be a missing issue file or wrong frontmatter if Task 5's store changes aren't applied yet. If Task 5 and 7 are both complete, this test should pass immediately — confirming that the success path works end-to-end.
**Step 3 — Write minimal implementation**
No production code changes needed — Task 7 already returns `JSON.stringify(result)` on success, and Task 5 already extended `store.createIssue` to accept and persist `milestone` and `priority`. This task only adds the success-path test.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/create-issue-tool-success.test.ts`
Expected: PASS
Run: `bun test`
Expected: all passing
