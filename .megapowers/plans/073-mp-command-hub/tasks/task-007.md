---
id: 7
title: Register create_issue tool with Zod validation (missing title / invalid
  type → error)
status: approved
depends_on:
  - 5
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
files_to_create:
  - extensions/megapowers/tools/create-issue-schema.ts
  - extensions/megapowers/tools/tool-create-issue.ts
---

### Task 7: Register create_issue tool with Zod validation (missing title / invalid type → error)

**Files:**
- Create: `extensions/megapowers/tools/create-issue-schema.ts`
- Create: `extensions/megapowers/tools/tool-create-issue.ts`
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/create-issue-tool-validation.test.ts`

**Step 1 — Write the failing test**
Create `tests/create-issue-tool-validation.test.ts`:
```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/create-issue-tool-validation.test.ts`
Expected: FAIL — `expected undefined to be defined` (because `create_issue` is not registered yet)

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/tools/create-issue-schema.ts`:
```ts
import { z } from "zod";
export const CreateIssueInputSchema = z.object({
  title: z.string({ required_error: "title is required" }).min(1, "title is required"),
  type: z.enum(["feature", "bugfix"], { required_error: "type is required" }),
  description: z.string({ required_error: "description is required" }).min(1, "description is required"),
  milestone: z.string().min(1).optional(),
  priority: z.number().optional(),
  sources: z.array(z.number()).optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;
```

Create `extensions/megapowers/tools/tool-create-issue.ts`:
```ts
import { CreateIssueInputSchema } from "./create-issue-schema.js";
import type { Store } from "../state/store.js";

export type CreateIssueOk = { slug: string; id: number };
export type CreateIssueErr = { error: string };

export function createIssueHandler(
  store: Pick<Store, "createIssue">,
  params: unknown,
): CreateIssueOk | CreateIssueErr {
  const parsed = CreateIssueInputSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const p = parsed.data;
  const issue = store.createIssue(p.title, p.type, p.description, p.sources, p.milestone, p.priority);
  return { slug: issue.slug, id: issue.id };
}
```

Modify `extensions/megapowers/register-tools.ts` to register the new tool (place it near `create_batch`):
```ts
import { createIssueHandler } from "./tools/tool-create-issue.js";

// ... inside registerTools(pi, runtimeDeps)

  pi.registerTool({
    name: "create_issue",
    label: "Create Issue",
    description: "Create a new issue file via validated parameters.",
    // IMPORTANT: keep fields optional here so zod validation errors are returned from execute()
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "Required" })),
      type: Type.Optional(Type.String({ description: "Required: feature|bugfix" })),
      description: Type.Optional(Type.String({ description: "Required" })),
      milestone: Type.Optional(Type.String()),
      priority: Type.Optional(Type.Number()),
      sources: Type.Optional(Type.Array(Type.Number())),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = createIssueHandler(store, params);
      if ("error" in result) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: undefined,
      };
    },
  });
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/create-issue-tool-validation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
