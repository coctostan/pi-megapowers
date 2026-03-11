import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { RuntimeDeps } from "./commands.js";
import { ensureDeps } from "./commands.js";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { readState } from "./state/state-io.js";
import { handleSignal, handlePlanDraftDone, type SignalResult } from "./tools/tool-signal.js";
import { handlePlanTask } from "./tools/tool-plan-task.js";
import { handlePlanReview } from "./tools/tool-plan-review.js";
import { createBatchHandler } from "./tools/tools.js";
import { createIssueHandler } from "./tools/tool-create-issue.js";

export function registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void {
  // --- Tools: megapowers_signal ---

  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description: "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), plan_draft_done (signal draft is complete — transitions planMode from draft/revise to review and starts a new session), phase_next (advance to the next workflow phase), phase_back (go back one phase — e.g. verify→implement, code-review→implement; errors if no backward transition exists), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run), close_issue (mark issue as done, reset state — done phase only). Note: review_approve is deprecated — use the megapowers_plan_review tool instead.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("task_done"),
        Type.Literal("review_approve"),
        Type.Literal("phase_next"),
        Type.Literal("phase_back"),
        Type.Literal("tests_failed"),
        Type.Literal("tests_passed"),
        Type.Literal("plan_draft_done"),
        Type.Literal("close_issue"),
      ]),
      target: Type.Optional(Type.String({ description: "Target phase for phase_next (enables backward transitions)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      let result: SignalResult;
      if (params.action === "plan_draft_done") {
        result = await handlePlanDraftDone(ctx.cwd);
      } else {
        result = handleSignal(ctx.cwd, params.action, params.target);
      }
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
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
        (ctx.sessionManager as any)?.newSession?.();
      }

      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
  });


  // --- Tools: create_issue ---

  pi.registerTool({
    name: "create_issue",
    label: "Create Issue",
    description: "Create a new issue file via validated parameters.",
    // Keep fields optional here so zod validation errors are returned from execute()
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "Required" })),
      type: Type.Optional(Type.String({ description: "Required: feature|bugfix" })),
      description: Type.Optional(Type.String({ description: "Required" })),
      milestone: Type.Optional(Type.String()),
      priority: Type.Optional(Type.Number()),
      sources: Type.Optional(Type.Array(Type.Number())),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = createIssueHandler(store, params);
      if ("error" in result) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: undefined,
      };
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
}

