import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import { canWrite, isTestFile } from "./policy/write-policy.js";
import type { TddTaskState } from "./state/state-machine.js";
import { Type } from "@sinclair/typebox";

// --- Detection ---

export interface SatelliteDetectionContext {
  isTTY: boolean | undefined;
  env: Record<string, string | undefined>;
}

/**
 * Detect if the current session is running as a satellite (subagent).
 *
 * A session is satellite only when PI_SUBAGENT=1 is set in environment.
 * This is the explicit signal from the pi subagent tool.
 *
 * We no longer use isTTY === false as a signal because non-interactive
 * contexts (CI, piped output) would incorrectly skip primary features.
 */
export function isSatelliteMode(ctx: SatelliteDetectionContext): boolean {
  return ctx.env.PI_SUBAGENT === "1";
}

/**
 * Resolve the project root for state reads.
 * In satellite mode (subagent), the cwd is the jj workspace dir which
 * doesn't have .megapowers/state.json. MEGA_PROJECT_ROOT points to the
 * actual project root where state.json lives.
 */
export function resolveProjectRoot(
  cwd: string,
  env: Record<string, string | undefined>,
): string {
  const projectRoot = env.MEGA_PROJECT_ROOT;
  if (projectRoot && projectRoot.length > 0) return projectRoot;
  return cwd;
}

// --- Satellite setup ---

/**
 * Set up satellite mode: TDD enforcement + limited megapowers_signal tool.
 * Called from index.ts when isSatelliteMode() returns true.
 */
export function setupSatellite(pi: ExtensionAPI): void {
  // Satellite sessions: TDD enforcement uses in-memory state (AC47/AC48).
  // We read phase/megaEnabled/activeIssue from disk once, but TDD cycle
  // state stays in-memory to avoid competing with the primary session for
  // state.json writes.
  //
  // Satellites keep TDD state in-memory and expose a limited megapowers_signal
  // tool for explicit tests_failed/tests_passed transitions.

  let satelliteTddState: TddTaskState | null = null;

  pi.on("tool_call", async (event, ctx) => {
    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath: string | undefined = (event.input as any)?.path;
    if (!filePath) return;

    // Read coordination state from project root (not workspace cwd) so
    // subagents in jj workspace dirs can find .megapowers/state.json (AC16)
    const projectRoot = resolveProjectRoot(ctx.cwd, process.env as Record<string, string | undefined>);
    const state = readState(projectRoot);
    let taskIsNoTest = false;
    if (state.activeIssue && (state.phase === "implement" || state.phase === "code-review")) {
      const tasks = deriveTasks(projectRoot, state.activeIssue);
      const currentTask = tasks[state.currentTaskIndex];
      taskIsNoTest = currentTask?.noTest ?? false;
    }

    // Use pure canWrite with in-memory TDD state
    const decision = canWrite(state.phase, filePath, state.megaEnabled, taskIsNoTest, satelliteTddState);
    if (!decision.allowed) {
      return { block: true, reason: decision.reason };
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    const toolName = event.toolName;

    // After a successful write of a test file, update in-memory TDD state
    if ((toolName === "write" || toolName === "edit") && !event.isError) {
      const filePath: string | undefined = (event.input as any)?.path;
      if (filePath && isTestFile(filePath)) {
        const projectRoot = resolveProjectRoot(ctx.cwd, process.env as Record<string, string | undefined>);
        const state = readState(projectRoot);
        const isTddPhase = state.phase === "implement" || state.phase === "code-review";
        if (isTddPhase && state.megaEnabled) {
          const tasks = state.activeIssue ? deriveTasks(projectRoot, state.activeIssue) : [];
          const currentTask = tasks[state.currentTaskIndex];
          const taskIndex = currentTask?.index ?? state.currentTaskIndex + 1;
          satelliteTddState = {
            taskIndex,
            state: "test-written",
            skipped: satelliteTddState?.skipped ?? false,
          };
        }
      }
    }
  });

  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description: "Satellite TDD signals: tests_failed (mark RED), tests_passed (acknowledge GREEN).",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("tests_failed"), Type.Literal("tests_passed")]),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const projectRoot = resolveProjectRoot(ctx.cwd, process.env as Record<string, string | undefined>);
      const state = readState(projectRoot);
      if (!state.megaEnabled) {
        return { content: [{ type: "text", text: "Error: Megapowers is disabled (megaEnabled=false)." }], details: undefined };
      }
      if (state.phase !== "implement" && state.phase !== "code-review") {
        return { content: [{ type: "text", text: `Error: ${params.action} can only be called during implement/code-review.` }], details: undefined };
      }

      if (params.action === "tests_failed") {
        if (!satelliteTddState || satelliteTddState.state !== "test-written") {
          return { content: [{ type: "text", text: "Error: No test written yet, or tests have not failed yet." }], details: undefined };
        }
        satelliteTddState = { ...satelliteTddState, state: "impl-allowed" };
        return {
          content: [{ type: "text", text: "Tests failed (RED ✓). Production code writes are now allowed." }],
          details: undefined,
        };
      }

      return { content: [{ type: "text", text: "Tests passed (GREEN ✓)." }], details: undefined };
    },
  });
}

