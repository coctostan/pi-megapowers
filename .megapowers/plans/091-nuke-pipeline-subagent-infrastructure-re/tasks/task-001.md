---
id: 1
title: Remove legacy pipeline and subagent tool registration
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/register-tools.test.ts
files_to_create: []
---

### Task 1: Remove legacy pipeline and subagent tool registration

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**
Replace `tests/register-tools.test.ts` with:

```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts`
Expected: FAIL — `expect(received).not.toContain(expected)` fails because `pipeline`, `subagent`, and legacy handler imports are still present in `extensions/megapowers/register-tools.ts`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/register-tools.ts`:

1. Remove these imports entirely:

```ts
import { handleOneshotTool } from "./subagent/oneshot-tool.js";
import { PiSubagentsDispatcher } from "./subagent/pi-subagents-dispatcher.js";
import { handlePipelineTool } from "./subagent/pipeline-tool.js";
import { buildPipelineDetails, renderPipelineCall, renderPipelineResult } from "./subagent/pipeline-renderer.js";
import type { PipelineProgressEvent } from "./subagent/pipeline-renderer.js";
```

2. Delete the entire `// --- Tools: subagent ---` registration block.
3. Delete the entire `// --- Tools: pipeline ---` registration block.
4. Leave the existing `megapowers_signal`, `megapowers_plan_task`, `megapowers_plan_review`, `create_issue`, and `create_batch` registrations unchanged.

The tail of `registerTools()` should end immediately after the `create_batch` tool registration:

```ts
  pi.registerTool({
    name: "create_batch",
    label: "Create Batch Issue",
    description: "Create a batch issue grouping source issues.",
    parameters: Type.Object({
      title: Type.String(),
      type: StringEnum(["bugfix", "feature"] as const),
      sourceIds: Type.Array(Type.Number()),
      description: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = createBatchHandler(store, params);
      if ("error" in result) {
        return { content: [{ type: "text", text: result.error }], details: undefined };
      }
      return {
        content: [{ type: "text", text: `Created batch: ${result.slug} (id: ${result.id})` }],
        details: undefined,
      };
    },
  });
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
