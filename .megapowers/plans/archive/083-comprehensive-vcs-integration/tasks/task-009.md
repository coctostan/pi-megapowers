---
id: 9
title: createPR in pr-creator.ts
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/vcs/pr-creator.ts
  - tests/pr-creator.test.ts
---

### Task 9: createPR in pr-creator.ts

**Files:**
- Create: `extensions/megapowers/vcs/pr-creator.ts`
- Create: `tests/pr-creator.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/pr-creator.test.ts
import { describe, it, expect } from "bun:test";
import { createPR, type ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";

describe("createPR", () => {
  it("creates PR with correct gh arguments and returns URL (AC12)", async () => {
    const calls: { cmd: string; args: string[] }[] = [];
    const execCmd: ExecCmd = async (cmd, args) => {
      calls.push({ cmd, args });
      if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
      return { stdout: "gh version 2.0.0\n", stderr: "" };
    };

    const result = await createPR(execCmd, "feat/my-feature", "Add feature", "Feature body");
    expect(result).toEqual({ ok: true, url: "https://github.com/org/repo/pull/42" });
    expect(calls[1]).toEqual({
      cmd: "gh",
      args: ["pr", "create", "--title", "Add feature", "--body", "Feature body", "--head", "feat/my-feature"],
    });
  });

  it("returns skipped when gh is not installed (AC12)", async () => {
    const execCmd: ExecCmd = async () => {
      throw new Error("command not found: gh");
    };

    const result = await createPR(execCmd, "feat/my-feature", "Title", "Body");
    expect(result).toEqual({ skipped: true, reason: "gh CLI not installed" });
  });

  it("returns ok: false when gh pr create fails (AC12)", async () => {
    const execCmd: ExecCmd = async (_cmd, args) => {
      if (args[0] === "pr") throw new Error("authentication required");
      return { stdout: "gh version 2.0.0\n", stderr: "" };
    };

    const result = await createPR(execCmd, "feat/my-feature", "Title", "Body");
    expect(result).toEqual({ ok: false, error: "authentication required" });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pr-creator.test.ts`
Expected: FAIL — Cannot find module "../extensions/megapowers/vcs/pr-creator.js"

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/vcs/pr-creator.ts

/** Injected command executor — throws on non-zero exit. */
export type ExecCmd = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export type PRResult =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

/**
 * AC11, AC12: Create a GitHub PR via `gh` CLI.
 * Checks gh availability first; returns skipped if not installed.
 */
export async function createPR(
  execCmd: ExecCmd,
  branchName: string,
  title: string,
  body: string,
): Promise<PRResult> {
  // Check gh availability
  try {
    await execCmd("gh", ["--version"]);
  } catch {
    return { skipped: true, reason: "gh CLI not installed" };
  }

  try {
    const result = await execCmd("gh", [
      "pr", "create",
      "--title", title,
      "--body", body,
      "--head", branchName,
    ]);
    const url = result.stdout.trim();
    return { ok: true, url };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "createPR failed" };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pr-creator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
