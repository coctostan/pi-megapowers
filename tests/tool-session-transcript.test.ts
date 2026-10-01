import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

type TranscriptMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: { type: "toolCall"; id: string; name: string; arguments: unknown }[] }
  | { role: "toolResult"; toolCallId: string; toolName: string; content: unknown; isError: boolean };

// Models the relevant Pi persistence boundary without importing the Pi runtime:
// the assistant is persisted before execute(), the result after execute(), and
// the next provider request projects messages from the session manager.
class TranscriptSessionManager {
  private messages: TranscriptMessage[] = [];

  appendMessage(message: TranscriptMessage): void {
    this.messages.push(message);
  }

  newSession(): void {
    this.messages = [];
  }

  buildSessionProjection(): { messages: TranscriptMessage[] } {
    return { messages: [...this.messages] };
  }
}

describe("Megapowers transition tool transcript pairing", () => {
  it.each(["phase_next", "task_done"] as const)(
    "%s preserves the originating call when Pi persists its result",
    async (action) => {
      const cwd = mkdtempSync(join(tmpdir(), "megapowers-transcript-"));
      try {
        writeState(cwd, {
          ...createInitialState(),
          activeIssue: "001-repro",
          workflow: "feature",
          phase: action === "task_done" ? "implement" : "brainstorm",
          tddTaskState: action === "task_done"
            ? { taskIndex: 1, state: "impl-allowed", skipped: false }
            : null,
        });
        if (action === "task_done") {
          const planDir = join(cwd, ".megapowers", "plans", "001-repro");
          mkdirSync(planDir, { recursive: true });
          writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
        }

        const tools: Record<string, any> = {};
        registerTools({
          registerTool: (tool: any) => { tools[tool.name] = tool; },
          exec: async () => ({ code: 1, stdout: "", stderr: "" }),
        } as any, {});

        const sessionManager = new TranscriptSessionManager();
        const toolCallId = `call_repro_${action}`;
        sessionManager.appendMessage({ role: "user", content: "Continue" });
        sessionManager.appendMessage({
          role: "assistant",
          content: [{ type: "toolCall", id: toolCallId, name: "megapowers_signal", arguments: { action } }],
        });
        const result = await tools.megapowers_signal.execute(
          toolCallId, { action }, undefined, undefined,
          { cwd, hasUI: false, sessionManager },
        );
        // Verify the workflow operation succeeded, not an unrelated gate error.
        expect(result.content[0].text).not.toStartWith("Error:");
        if (action === "task_done") {
          expect(readState(cwd).completedTasks).toEqual([1]);
          expect(readState(cwd).currentTaskIndex).toBe(1);
        } else {
          expect(readState(cwd).phase).toBe("spec");
        }

        // Pi records a normal tool result only after execute() returns.
        sessionManager.appendMessage({
          role: "toolResult", toolCallId, toolName: "megapowers_signal",
          content: result.content, isError: false,
        });
        const messages = sessionManager.buildSessionProjection().messages;
        const calls = new Set(messages.flatMap((message) =>
          message.role === "assistant" ? message.content.map((call) => call.id) : [],
        ));
        const orphanedResults = messages.flatMap((message) =>
          message.role === "toolResult" && !calls.has(message.toolCallId) ? [message.toolCallId] : [],
        );
        expect(orphanedResults).toEqual([]);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  );
});
