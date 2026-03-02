import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { RuntimeDeps } from "./commands.js";
import { ensureDeps } from "./commands.js";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { readState } from "./state/state-io.js";
import { showDoneChecklist } from "./ui.js";
import { handleSignal } from "./tools/tool-signal.js";
import { handlePlanTask } from "./tools/tool-plan-task.js";
import { handlePlanReview } from "./tools/tool-plan-review.js";
import { createBatchHandler } from "./tools/tools.js";
import { handleOneshotTool } from "./subagent/oneshot-tool.js";
import { PiSubagentsDispatcher } from "./subagent/pi-subagents-dispatcher.js";
import { handlePipelineTool } from "./subagent/pipeline-tool.js";

export function registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void {
  // --- Tools: megapowers_signal ---

  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description: "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), plan_draft_done (signal draft is complete — transitions planMode from draft/revise to review and starts a new session), phase_next (advance to the next workflow phase), phase_back (go back one phase — e.g. verify→implement, code-review→implement; errors if no backward transition exists), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run). Note: review_approve is deprecated — use the megapowers_plan_review tool instead.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("task_done"),
        Type.Literal("review_approve"),
        Type.Literal("phase_next"),
        Type.Literal("phase_back"),
        Type.Literal("tests_failed"),
        Type.Literal("tests_passed"),
        Type.Literal("plan_draft_done"),
      ]),
      target: Type.Optional(Type.String({ description: "Target phase for phase_next (enables backward transitions)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store, jj, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = handleSignal(ctx.cwd, params.action, jj, params.target);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      if (result.triggerNewSession) {
        const parent = ctx.sessionManager?.getSessionFile?.();
        (ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });
      }

      // AC11: Show done checklist when phase_next advances to done
      // Trigger is here ONLY — not in hooks.ts — to prevent duplicate presentation
      if (params.action === "phase_next") {
        const currentState = readState(ctx.cwd);
        if (currentState.phase === "done") {
          await showDoneChecklist(ctx, ctx.cwd);
        }
      }

      if (ctx.hasUI) {
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
  });

  // --- Tools: megapowers_plan_task ---

  pi.registerTool({
    name: "megapowers_plan_task",
    label: "Plan Task",
    description: "Save or update a plan task. During draft mode, creates new tasks. During revise mode, updates existing tasks (partial — only provided fields are merged).",
    parameters: Type.Object({
      id: Type.Number({ description: "Task ID (1-based, sequential)" }),
      title: Type.Optional(Type.String({ description: "Short task title" })),
      description: Type.Optional(Type.String({ description: "Full task body — TDD steps, code blocks, implementation details (markdown)" })),
      depends_on: Type.Optional(Type.Array(Type.Number(), { description: "IDs of tasks this depends on" })),
      no_test: Type.Optional(Type.Boolean({ description: "true if this task doesn't need TDD" })),
      files_to_modify: Type.Optional(Type.Array(Type.String(), { description: "Existing files this task changes" })),
      files_to_create: Type.Optional(Type.Array(Type.String(), { description: "New files this task creates" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handlePlanTask(ctx.cwd, params);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
  });

  // --- Tools: megapowers_plan_review ---

  pi.registerTool({
    name: "megapowers_plan_review",
    label: "Plan Review",
    description: "Submit plan review verdict. Approves the plan or requests revisions with per-task feedback.",
    parameters: Type.Object({
      verdict: StringEnum(["approve", "revise"] as const),
      feedback: Type.String({ description: "Review feedback — per-task assessment, issues found, suggestions (markdown)" }),
      approved_tasks: Type.Optional(Type.Array(Type.Number(), { description: "Task IDs that pass review" })),
      needs_revision_tasks: Type.Optional(Type.Array(Type.Number(), { description: "Task IDs that need revision" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handlePlanReview(ctx.cwd, params);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      if (result.triggerNewSession) {
        const parent = ctx.sessionManager?.getSessionFile?.();
        (ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });
      }

      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
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
    description: "Run a one-shot subagent task in an isolated jj workspace and squash changes back on success.",
    parameters: Type.Object({
      task: Type.String({ description: "Task description for the subagent" }),
      agent: Type.Optional(Type.String({ description: "Agent name (default: worker)" })),
      timeoutMs: Type.Optional(Type.Number({ description: "Timeout in milliseconds" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const execJJ = async (args: string[], opts?: { cwd?: string }) => {
        const r = await pi.exec("jj", args, opts?.cwd ? { cwd: opts.cwd } : undefined);
        return { code: r.code, stdout: r.stdout, stderr: r.stderr };
      };

      const { discoverAgents } = await import("pi-subagents/agents.js");
      const { runSync } = await import("pi-subagents/execution.js");
      const { agents } = discoverAgents(ctx.cwd, "both");
      const dispatcher = new PiSubagentsDispatcher({ runSync, runtimeCwd: ctx.cwd, agents });

      const r = await handleOneshotTool(ctx.cwd, params, dispatcher, execJJ);
      if (r.error) return { content: [{ type: "text", text: `Error: ${r.error}` }], details: undefined };

      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], details: undefined };
    },
  });

  // --- Tools: pipeline ---

  pi.registerTool({
    name: "pipeline",
    label: "Pipeline",
    description: "Run the implement → verify → review pipeline for a plan task in an isolated jj workspace. When resuming a paused pipeline, guidance is required.",
    parameters: Type.Object({
      taskIndex: Type.Number({ description: "Task index to run" }),
      resume: Type.Optional(Type.Boolean({ description: "Resume a paused pipeline" })),
      guidance: Type.Optional(Type.String({ description: "Required when resume is true — actionable direction for retry" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const execJJ = async (args: string[], opts?: { cwd?: string }) => {
        const r = await pi.exec("jj", args, opts?.cwd ? { cwd: opts.cwd } : undefined);
        return { code: r.code, stdout: r.stdout, stderr: r.stderr };
      };

      const { discoverAgents } = await import("pi-subagents/agents.js");
      const { runSync } = await import("pi-subagents/execution.js");
      const { agents } = discoverAgents(ctx.cwd, "both");
      const dispatcher = new PiSubagentsDispatcher({ runSync, runtimeCwd: ctx.cwd, agents });

      const r = await handlePipelineTool(
        ctx.cwd,
        { taskIndex: params.taskIndex, resume: params.resume, guidance: params.guidance },
        dispatcher,
        execJJ,
      );

      if (r.error) return { content: [{ type: "text", text: `Error: ${r.error}` }], details: undefined };

      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], details: undefined };
    },
  });
}
