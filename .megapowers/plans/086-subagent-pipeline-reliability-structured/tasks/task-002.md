---
id: 2
title: Define VerifyResult type and runVerifyStep shell function
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/subagent/pipeline-steps.ts
  - tests/pipeline-steps.test.ts
---

### Task 2: Define VerifyResult type and runVerifyStep shell function

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-steps.ts`
- Test: `tests/pipeline-steps.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pipeline-steps.test.ts
import { describe, it, expect } from "bun:test";
import { runVerifyStep, type ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";

describe("runVerifyStep", () => {
  it("returns passed=true with exit code 0 and captures output", async () => {
    const mockExec: ExecShell = async () => ({
      exitCode: 0,
      stdout: "3 pass\n0 fail",
      stderr: "",
    });

    const result = await runVerifyStep("bun test", "/workspace", mockExec);
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("3 pass");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns passed=false with non-zero exit code", async () => {
    const mockExec: ExecShell = async () => ({
      exitCode: 1,
      stdout: "2 pass\n1 fail\nERROR: expected true to be false",
      stderr: "test failed",
    });

    const result = await runVerifyStep("bun test", "/workspace", mockExec);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("1 fail");
    expect(result.output).toContain("test failed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-steps.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/subagent/pipeline-steps.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/subagent/pipeline-steps.ts

export type ExecShell = (
  cmd: string,
  cwd: string,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
  durationMs: number;
}

export async function runVerifyStep(
  testCommand: string,
  cwd: string,
  exec: ExecShell,
): Promise<VerifyResult> {
  const t0 = Date.now();
  const result = await exec(testCommand, cwd);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return {
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    output,
    durationMs: Date.now() - t0,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-steps.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
