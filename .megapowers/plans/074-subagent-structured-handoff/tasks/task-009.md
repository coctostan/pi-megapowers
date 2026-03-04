---
id: 9
title: Implement renderPipelineCall function
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
files_to_create: []
---

### Task 9: Implement renderPipelineCall function [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

Add to `tests/pipeline-renderer.test.ts`:
```typescript
import {
  renderPipelineCall,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

// Create a minimal mock theme that returns plain text (no ANSI)
const mockTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as any;

// Helper to extract text from a TUI component
function renderToString(component: any): string {
  return component.render(120).join("\n");
}

describe("renderPipelineCall", () => {
  it("renders task index for a fresh pipeline run", () => {
    const result = renderPipelineCall({ taskIndex: 3 }, mockTheme);
    const text = renderToString(result);
    expect(text).toContain("pipeline");
    expect(text).toContain("3");
  });

  it("renders resume info when resume is true", () => {
    const result = renderPipelineCall(
      { taskIndex: 2, resume: true, guidance: "Fix the failing test" },
      mockTheme,
    );
    const text = renderToString(result);
    expect(text).toContain("resume");
    expect(text).toContain("2");
  });

  it("renders without resume indicator when not resuming", () => {
    const result = renderPipelineCall({ taskIndex: 1 }, mockTheme);
    const text = renderToString(result);
    expect(text).not.toContain("resume");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineCall"`
Expected: FAIL — `renderPipelineCall is not a function` or `is not exported`

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
import { Text } from "@mariozechner/pi-tui";

export function renderPipelineCall(
  args: { taskIndex: number; resume?: boolean; guidance?: string },
  theme: any,
): InstanceType<typeof Text> {
  let text = theme.fg("toolTitle", theme.bold("pipeline "));
  text += theme.fg("accent", `task ${args.taskIndex}`);

  if (args.resume) {
    text += theme.fg("warning", " (resume)");
    if (args.guidance) {
      const preview = args.guidance.length > 60 ? `${args.guidance.slice(0, 60)}...` : args.guidance;
      text += "\n  " + theme.fg("dim", preview);
    }
  }

  return new Text(text, 0, 0);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts --test-name-pattern "renderPipelineCall"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
