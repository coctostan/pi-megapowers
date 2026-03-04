---
id: 11
title: Update oneshot-tool.ts to use discriminated union checks
status: approved
depends_on:
  - 6
  - 8
  - 10
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/oneshot-tool.ts
  - tests/oneshot-tool.test.ts
files_to_create: []
---

### Task 11: Update oneshot-tool.ts to use discriminated union checks [depends: 6, 8, 10]

**Files:**
- Modify: `extensions/megapowers/subagent/oneshot-tool.ts`
- Test: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**

Add to `tests/oneshot-tool.test.ts`:

```typescript
  it("uses discriminated union checks (no as-any casts)", async () => {
    // Verify the source code has no (as any).error casts
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/oneshot-tool.ts"),
      "utf-8",
    );
    expect(source).not.toContain("(ws as any).error");
    expect(source).not.toContain("(squash as any).error");
    expect(source).not.toContain("(cleanup as any).error");
    // Should use .ok checks instead
    expect(source).toContain(".ok");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: FAIL — Expected source to not contain "(ws as any).error" (current code has 3 `(as any).error` casts)

**Step 3 — Write minimal implementation**

Replace `handleOneshotTool` in `extensions/megapowers/subagent/oneshot-tool.ts`:

```typescript
import type { Dispatcher } from "./dispatcher.js";
import { readState } from "../state/state-io.js";
import {
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  type ExecGit,
} from "./pipeline-workspace.js";
import { parseStepResult } from "./pipeline-results.js";

export interface OneshotToolInput {
  task: string;
  agent?: string;
  timeoutMs?: number;
}

export interface OneshotToolOutput {
  id: string;
  output?: string;
  filesChanged?: string[];
  error?: string;
}

export async function handleOneshotTool(
  projectRoot: string,
  input: OneshotToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
): Promise<OneshotToolOutput> {
  const state = readState(projectRoot);
  if (!state.megaEnabled) return { id: "", error: "Megapowers is disabled." };

  const id = `oneshot-${Date.now()}`;

  const ws = await createPipelineWorkspace(projectRoot, id, execGit);
  if (!ws.ok) return { id, error: `Workspace creation failed: ${ws.error}` };

  const dispatch = await dispatcher.dispatch({
    agent: input.agent ?? "worker",
    task: input.task,
    cwd: ws.workspacePath,
    timeoutMs: input.timeoutMs,
  });

  const parsed = parseStepResult(dispatch);

  let workspaceError: string | undefined;

  if (dispatch.exitCode === 0) {
    const squash = await squashPipelineWorkspace(projectRoot, id, execGit);
    if (!squash.ok) workspaceError = `Squash failed: ${squash.error}`;
  } else {
    const cleanup = await cleanupPipelineWorkspace(projectRoot, id, execGit);
    if (!cleanup.ok) workspaceError = `Cleanup failed: ${cleanup.error}`;
  }

  return {
    id,
    output: parsed.finalOutput || undefined,
    filesChanged: parsed.filesChanged.length ? parsed.filesChanged : undefined,
    error: workspaceError ?? (dispatch.exitCode === 0 ? undefined : dispatch.error ?? parsed.error),
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
