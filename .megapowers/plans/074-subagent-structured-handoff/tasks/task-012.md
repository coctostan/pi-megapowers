---
id: 12
title: Wire renderCall and renderResult into pipeline tool registration
status: approved
depends_on:
  - 9
  - 10
  - 11
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/register-tools.test.ts
files_to_create: []
---

### Task 12: Wire renderCall and renderResult into pipeline tool registration [depends: 9, 10, 11]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**

Add to `tests/register-tools.test.ts`:
```typescript
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool registration includes renderCall"`
Expected: FAIL — `expect(received).toBe(expected)` — `typeof pipeline.renderCall` is `"undefined"`, expected `"function"`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, add the import at the top:
```typescript
import { renderPipelineCall, renderPipelineResult } from "./subagent/pipeline-renderer.js";
```

In the pipeline tool registration (around line 188), add `renderCall` and `renderResult` properties to the object passed to `pi.registerTool({...})`:

```typescript
    renderCall(args, theme) {
      return renderPipelineCall(args, theme);
    },

    renderResult(result, options, theme) {
      return renderPipelineResult(result as any, options, theme);
    },
```

These go after the `parameters` property and before the `execute` method in the pipeline tool registration object.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool registration includes renderCall"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
