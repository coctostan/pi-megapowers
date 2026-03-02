import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { onContext } from "../extensions/megapowers/hooks.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", megaEnabled: true, ...overrides });
}

function makeSessionManager() {
  const sm: any = {
    _messages: [{ role: "user", content: [{ type: "text", text: "old" }], timestamp: 0 }],
    getSessionFile: () => "session.jsonl",
    newSessionCalls: 0,
    newSession: (_opts?: any) => {
      sm.newSessionCalls++;
      sm._messages = [];
      return "new-session-id";
    },
    buildSessionContext: () => ({ messages: sm._messages, thinkingLevel: "off", model: null }),
  };
  return sm;
}

describe("newSession wiring", () => {
  it("megapowers_signal(plan_draft_done) starts a new session and context hook uses the new session messages", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-signal-"));
    try {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

      // at least 1 task file required
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_signal.execute("1", { action: "plan_draft_done" }, undefined, undefined, ctx);

      expect(sessionManager.newSessionCalls).toBe(1);

      const contextResult = await onContext({ type: "context", messages: [] }, ctx, {} as any);
      expect(contextResult.messages).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("megapowers_plan_review(revise) starts a new session", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "new-session-review-"));
    try {
      setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });

      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => {
          tools[tool.name] = tool;
        },
        exec: async () => ({ code: 1, stdout: "", stderr: "" }),
      } as any;

      registerTools(pi, {} as any);

      const sessionManager = makeSessionManager();
      const ctx = { cwd: tmp, hasUI: false, sessionManager } as any;

      await tools.megapowers_plan_review.execute(
        "1",
        { verdict: "revise", feedback: "Fix task 1.", approved_tasks: [], needs_revision_tasks: [1] },
        undefined,
        undefined,
        ctx,
      );

      expect(sessionManager.newSessionCalls).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("uses a type-safe any-cast for sessionManager newSession access", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
    expect(source).not.toContain("ctx.sessionManager?.newSession?.(");
    expect(source).toContain("(ctx.sessionManager as any)?.newSession?.(");
  });
});
