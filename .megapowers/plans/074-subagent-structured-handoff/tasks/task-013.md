---
id: 13
title: Wire onProgress to onUpdate in pipeline tool handler
status: approved
depends_on:
  - 8
  - 12
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - extensions/megapowers/subagent/pipeline-tool.ts
  - tests/register-tools.test.ts
files_to_create: []
---

### Task 13: Wire onProgress to onUpdate in pipeline tool handler [depends: 8, 12]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/register-tools.test.ts`

**Step 1 — Write the failing test**

Add to `tests/register-tools.test.ts`:
```typescript
  it("pipeline tool handler passes onProgress to handlePipelineTool options", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
    // The pipeline tool execute function should reference onProgress and onUpdate
    expect(source).toContain("onProgress");
    expect(source).toContain("onUpdate");
    expect(source).toContain("buildPipelineDetails");
  });
```

Additionally, add a structural test to verify the wiring exists in `pipeline-tool.ts`:

Add to a new test file or extend `tests/pipeline-tool.test.ts`:
```typescript
// In tests/pipeline-tool.test.ts, add:
  it("handlePipelineTool passes onProgress from options to runPipeline", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/subagent/pipeline-tool.ts"), "utf-8");
    expect(source).toContain("onProgress");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool handler passes onProgress"`
Expected: FAIL — `expect(received).toContain(expected)` — "onProgress" not found in register-tools.ts source.

**Step 3 — Write minimal implementation**

**Modify `extensions/megapowers/subagent/pipeline-tool.ts`:**

Add the import:
```typescript
import type { PipelineProgressEvent } from "./pipeline-renderer.js";
```

Update `handlePipelineTool` signature to accept an optional `onProgress` callback:
```typescript
export async function handlePipelineTool(
  projectRoot: string,
  input: PipelineToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
  execShell?: ExecShell,
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<PipelineToolOutput> {
```

And pass it through to `runPipeline` options (around line 111-118):
```typescript
  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      projectRoot,
      workspaceCwd: workspacePath,
      pipelineId,
      agents: { implementer: "implementer", reviewer: "reviewer" },
      execGit,
      execShell,
      onProgress,
    },
  );
```

**Modify `extensions/megapowers/register-tools.ts`:**

Add imports:
```typescript
import { renderPipelineCall, renderPipelineResult, buildPipelineDetails } from "./subagent/pipeline-renderer.js";
import type { PipelineProgressEvent, PipelineToolDetails } from "./subagent/pipeline-renderer.js";
```

In the pipeline tool's `execute` function, wire up `onProgress` → `onUpdate`:
```typescript
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const execGit = async (args: string[]) => {
        const r = await pi.exec("git", args);
        if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
        return { stdout: r.stdout, stderr: r.stderr };
      };

      const { discoverAgents } = await import("pi-subagents/agents.js");
      const { runSync } = await import("pi-subagents/execution.js");
      const { agents } = discoverAgents(ctx.cwd, "both");
      const dispatcher = new PiSubagentsDispatcher({ runSync, runtimeCwd: ctx.cwd, agents });

      // Wire onProgress → onUpdate for live TUI rendering
      const progressEvents: PipelineProgressEvent[] = [];
      const taskTitle = `Task ${params.taskIndex}`;
      const pipelineId = `pipe-t${params.taskIndex}`;

      const onProgress = onUpdate
        ? (event: PipelineProgressEvent) => {
            progressEvents.push(event);
            const details = buildPipelineDetails(progressEvents, {
              taskIndex: params.taskIndex,
              taskTitle,
              pipelineId,
            });
            onUpdate({
              content: [{ type: "text", text: `Pipeline ${details.status}...` }],
              details: details as any,
            });
          }
        : undefined;

      const r = await handlePipelineTool(
        ctx.cwd,
        { taskIndex: params.taskIndex, resume: params.resume, guidance: params.guidance },
        dispatcher,
        execGit,
        undefined,
        onProgress,
      );

      if (r.error) return { content: [{ type: "text", text: `Error: ${r.error}` }], details: undefined };

      // Build final details for the result
      const finalDetails = buildPipelineDetails(progressEvents, {
        taskIndex: params.taskIndex,
        taskTitle,
        pipelineId: r.pipelineId ?? pipelineId,
      });
      // Update status based on actual result
      if (r.result?.status === "completed") finalDetails.status = "completed";
      else if (r.paused) finalDetails.status = "paused";

      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], details: finalDetails as any };
    },
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts --test-name-pattern "pipeline tool handler passes onProgress"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
