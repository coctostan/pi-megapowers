import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { RuntimeDeps } from "./commands.js";
import { ensureDeps } from "./commands.js";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { readState } from "./state/state-io.js";
import { handleSignal } from "./tools/tool-signal.js";
import { handleSaveArtifact } from "./tools/tool-artifact.js";
import { createBatchHandler } from "./tools/tools.js";
import { handleSubagentDispatch, handleSubagentStatus } from "./subagent/subagent-tools.js";
import { writeSubagentStatus, updateSubagentStatus } from "./subagent/subagent-status.js";
import { buildSpawnArgs, buildSpawnEnv, createRunnerState, processJsonlLine } from "./subagent/subagent-runner.js";
import { buildWorkspaceName, buildWorkspaceAddArgs, buildWorkspaceForgetArgs, buildDiffSummaryArgs, buildDiffFullArgs } from "./subagent/subagent-workspace.js";
import { detectRepeatedErrors } from "./subagent/subagent-errors.js";
import { parseTaskDiffFiles } from "./task-coordinator.js";

export function registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void {
  // --- Tools: megapowers_signal ---

  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description: "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), review_approve (approve plan in review phase), phase_next (advance to next workflow phase), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run).",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("task_done"),
        Type.Literal("review_approve"),
        Type.Literal("phase_next"),
        Type.Literal("tests_failed"),
        Type.Literal("tests_passed"),
      ]),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store, jj, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = handleSignal(ctx.cwd, params.action, jj);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      if (ctx.hasUI) {
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
  });

  // --- Tools: megapowers_save_artifact ---

  pi.registerTool({
    name: "megapowers_save_artifact",
    label: "Save Artifact",
    description: "Save a phase artifact to disk. Use phase names: spec, plan, brainstorm, reproduce, diagnosis, verify, code-review.",
    parameters: Type.Object({
      phase: Type.String(),
      content: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSaveArtifact(ctx.cwd, params.phase, params.content);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return { content: [{ type: "text", text: result.message ?? "Artifact saved." }], details: undefined };
    },
  });

  // --- Tools: create_batch ---

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

  // --- Tools: subagent ---

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: "Delegate a task to a subagent running in an isolated jj workspace. Returns immediately with a subagent ID. Use subagent_status to check progress.",
    parameters: Type.Object({
      task: Type.String({ description: "Task description for the subagent" }),
      taskIndex: Type.Optional(Type.Number({ description: "Plan task index (validates dependencies)" })),
      agent: Type.Optional(Type.String({ description: "Agent name (default: worker)" })),
      timeoutMs: Type.Optional(Type.Number({ description: "Timeout in milliseconds (default: 600000)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { jj } = ensureDeps(runtimeDeps, pi, ctx.cwd);

      const dispatchResult = await handleSubagentDispatch(ctx.cwd, {
        task: params.task,
        taskIndex: params.taskIndex,
        agent: params.agent,
        timeoutMs: params.timeoutMs,
      }, jj);

      if (dispatchResult.error) {
        return { content: [{ type: "text", text: `Error: ${dispatchResult.error}` }], details: undefined };
      }

      const config = dispatchResult.config!;
      const id = dispatchResult.id!;
      const promptFilePath = dispatchResult.promptFilePath!;
      const startedAt = Date.now();

      // Write initial status with parent's current workflow phase (AC5)
      const currentState = readState(ctx.cwd);
      writeSubagentStatus(ctx.cwd, id, {
        id,
        state: "running",
        turnsUsed: 0,
        startedAt,
        phase: currentState.phase ?? undefined,
      });

      // Create jj workspace and spawn (async, fire-and-forget)
      const wsName = buildWorkspaceName(id);

      (async () => {
        const runnerState = createRunnerState(id, startedAt);

        try {
          // Create jj workspace
          const wsResult = await pi.exec("jj", buildWorkspaceAddArgs(wsName, config.workspacePath));
          if (wsResult.code !== 0) {
            writeSubagentStatus(ctx.cwd, id, {
              id,
              state: "failed",
              turnsUsed: 0,
              startedAt,
              completedAt: Date.now(),
              error: `Failed to create jj workspace: ${wsResult.stderr}`,
            });
            return;
          }

          // Build spawn args — pass prompt as @file reference
          const args = buildSpawnArgs(promptFilePath, {
            model: config.model,
            tools: config.tools,
            thinking: config.thinking,
            systemPromptPath: config.systemPromptPath,
          });
          const env = buildSpawnEnv({
            subagentId: id,
            projectRoot: ctx.cwd,
          });

          const { spawn } = await import("node:child_process");
          const child = spawn(args[0], args.slice(1), {
            cwd: config.workspacePath,
            env,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
          });

          let stderr = "";
          let stdoutBuffer = "";

          child.stdout?.on("data", (data: Buffer) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split("\n");
            stdoutBuffer = lines.pop() || "";
            for (const line of lines) {
              processJsonlLine(runnerState, line);
            }
            if (!runnerState.isTerminal) {
              updateSubagentStatus(ctx.cwd, id, { turnsUsed: runnerState.turnsUsed });
            }
          });

          child.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

          // Timeout: set terminal flag and kill. Cleanup in close handler.
          const timer = setTimeout(() => {
            if (runnerState.isTerminal) return;
            runnerState.isTerminal = true;
            runnerState.timedOut = true;
            try { child.kill("SIGTERM"); } catch {}
            setTimeout(() => {
              try { if (!child.killed) child.kill("SIGKILL"); } catch {}
            }, 5000);
          }, config.timeoutMs);

          child.on("close", async (code) => {
            clearTimeout(timer);
            const detectedErrors = detectRepeatedErrors(runnerState.errorLines);

            if (runnerState.timedOut) {
              writeSubagentStatus(ctx.cwd, id, {
                id,
                state: "timed-out",
                turnsUsed: runnerState.turnsUsed,
                startedAt,
                completedAt: Date.now(),
                phase: currentState.phase ?? undefined,
                error: `Subagent timed out after ${config.timeoutMs / 1000}s`,
                detectedErrors: detectedErrors.length > 0 ? detectedErrors : undefined,
              });
            } else if (!runnerState.isTerminal) {
              runnerState.isTerminal = true;

              if (stdoutBuffer.trim()) {
                processJsonlLine(runnerState, stdoutBuffer);
              }

              if (code !== 0) {
                writeSubagentStatus(ctx.cwd, id, {
                  id,
                  state: "failed",
                  turnsUsed: runnerState.turnsUsed,
                  startedAt,
                  completedAt: Date.now(),
                  phase: currentState.phase ?? undefined,
                  error: `Process exited with code ${code}. ${stderr}`.trim(),
                  detectedErrors: detectedErrors.length > 0 ? detectedErrors : undefined,
                });
              } else {
                // Get diff from workspace (AC7)
                try {
                  const summaryResult = await pi.exec("jj", buildDiffSummaryArgs(), { cwd: config.workspacePath });
                  const filesChanged = parseTaskDiffFiles(summaryResult.stdout);
                  const fullDiffResult = await pi.exec("jj", buildDiffFullArgs(), { cwd: config.workspacePath });

                  const MAX_INLINE_DIFF = 100 * 1024;
                  let diff: string | undefined;
                  let diffPath: string | undefined;

                  if (fullDiffResult.stdout.length > MAX_INLINE_DIFF) {
                    const { join: joinPath } = await import("node:path");
                    const { writeFileSync: writeFile } = await import("node:fs");
                    const patchPath = joinPath(ctx.cwd, ".megapowers", "subagents", id, "diff.patch");
                    writeFile(patchPath, fullDiffResult.stdout);
                    diffPath = `.megapowers/subagents/${id}/diff.patch`;
                  } else {
                    diff = fullDiffResult.stdout;
                  }

                  writeSubagentStatus(ctx.cwd, id, {
                    id,
                    state: "completed",
                    turnsUsed: runnerState.turnsUsed,
                    startedAt,
                    completedAt: Date.now(),
                    phase: currentState.phase ?? undefined,
                    filesChanged,
                    diff,
                    diffPath,
                    testsPassed: runnerState.lastTestPassed ?? true,
                    detectedErrors: detectedErrors.length > 0 ? detectedErrors : undefined,
                  });
                } catch {
                  writeSubagentStatus(ctx.cwd, id, {
                    id,
                    state: "completed",
                    turnsUsed: runnerState.turnsUsed,
                    startedAt,
                    completedAt: Date.now(),
                    phase: currentState.phase ?? undefined,
                    testsPassed: runnerState.lastTestPassed ?? true,
                  });
                }
              }
            }

            // Always cleanup workspace (AC9)
            try {
              await pi.exec("jj", buildWorkspaceForgetArgs(wsName));
            } catch {}
          });

          child.unref();
        } catch (err) {
          runnerState.isTerminal = true;
          writeSubagentStatus(ctx.cwd, id, {
            id,
            state: "failed",
            turnsUsed: 0,
            startedAt,
            completedAt: Date.now(),
            phase: currentState.phase ?? undefined,
            error: `Spawn failed: ${err}`,
          });
          try {
            await pi.exec("jj", buildWorkspaceForgetArgs(wsName));
          } catch {}
        }
      })();

      return {
        content: [{ type: "text", text: `Subagent dispatched: ${id}\nWorkspace: ${wsName}\nUse subagent_status to check progress.` }],
        details: undefined,
      };
    },
  });

  // --- Tools: subagent_status ---

  pi.registerTool({
    name: "subagent_status",
    label: "Subagent Status",
    description: "Check the status of a running subagent. Returns JSON with state, files changed, test results, diff, and detected errors.",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID returned from the subagent tool" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSubagentStatus(ctx.cwd, params.id);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result.status!, null, 2) }],
        details: undefined,
      };
    },
  });
}
