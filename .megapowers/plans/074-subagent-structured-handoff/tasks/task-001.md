---
id: 1
title: Define PipelineProgressEvent type and add onProgress to PipelineOptions
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-runner.ts
files_to_create:
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - tests/pipeline-renderer.test.ts
---

### Task 1: Define PipelineProgressEvent type and add onProgress to PipelineOptions

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-renderer.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pipeline-renderer.test.ts
import { describe, it, expect } from "bun:test";
import type {
  PipelineProgressEvent,
  StepName,
} from "../extensions/megapowers/subagent/pipeline-renderer.js";

describe("PipelineProgressEvent types", () => {
  it("step-start event has correct shape", () => {
    const event: PipelineProgressEvent = {
      type: "step-start",
      step: "implement",
    };
    expect(event.type).toBe("step-start");
    expect(event.step).toBe("implement");
  });

  it("step-end event has correct shape with optional messages and error", () => {
    const event: PipelineProgressEvent = {
      type: "step-end",
      step: "review",
      durationMs: 1234,
      messages: [],
    };
    expect(event.type).toBe("step-end");
    expect(event.step).toBe("review");
    expect(event.durationMs).toBe(1234);
    expect(event.messages).toEqual([]);

    // step-end for verify has no messages
    const verifyEnd: PipelineProgressEvent = {
      type: "step-end",
      step: "verify",
      durationMs: 500,
      error: "tests failed",
    };
    expect(verifyEnd.messages).toBeUndefined();
  });

  it("retry event has correct shape", () => {
    const event: PipelineProgressEvent = {
      type: "retry",
      retryCount: 2,
      reason: "verify_failed",
    };
    expect(event.type).toBe("retry");
    expect(event.retryCount).toBe(2);
    expect(event.reason).toBe("verify_failed");
  });

  it("StepName covers all three pipeline steps", () => {
    const steps: StepName[] = ["implement", "verify", "review"];
    expect(steps).toHaveLength(3);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-renderer.test.ts`
Expected: FAIL — `error: Could not resolve: "../extensions/megapowers/subagent/pipeline-renderer.js"`

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/subagent/pipeline-renderer.ts`:
```typescript
import type { Message } from "@mariozechner/pi-ai";

export type StepName = "implement" | "verify" | "review";

export type PipelineProgressEvent =
  | { type: "step-start"; step: StepName }
  | { type: "step-end"; step: StepName; durationMs: number; error?: string; messages?: Message[] }
  | { type: "retry"; retryCount: number; reason: string };
```

Add to `extensions/megapowers/subagent/pipeline-runner.ts` — add the import and modify the `PipelineOptions` interface:

Add import at top:
```typescript
import type { PipelineProgressEvent } from "./pipeline-renderer.js";
```

Add to `PipelineOptions` interface after `execShell?`:
```typescript
  onProgress?: (event: PipelineProgressEvent) => void;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-renderer.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
