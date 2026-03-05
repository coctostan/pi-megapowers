import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPipelineWorkspace, type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

it("does not keep legacy done-action queue reproductions in reproduce-086", () => {
  const source = readFileSync(join(process.cwd(), "tests/reproduce-086-bugs.test.ts"), "utf-8");
  const legacyDescribeA = 'describe("Bug: close-issue done action never closes the issue' + '"';
  const legacyDescribeB = 'describe("Bug: done actions that don\'t need LLM content get stuck on short responses' + '"';
  expect(source).not.toContain(legacyDescribeA);
  expect(source).not.toContain(legacyDescribeB);
});

// ============================================================================
// Bug 3: onContext hook called non-existent buildSessionContext() — ALREADY FIXED
// ============================================================================

describe("Bug (fixed): onContext hook should not call buildSessionContext()", () => {
  it("onContext is a no-op and does not throw", async () => {
    const { onContext } = await import("../extensions/megapowers/hooks.js");

    const ctx = {
      cwd: "/tmp/fake",
      sessionManager: {
        // Does NOT have buildSessionContext — that was the bug
      },
    };

    // Before the fix, this would throw: ctx.sessionManager.buildSessionContext is not a function
    const result = await onContext({ type: "context", messages: [] }, ctx, {} as any);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Bug 5: Subagent workspace creation fails — parent directory not created
// ============================================================================

describe("Bug: subagent workspace creation fails on fresh repo", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "workspace-create-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("should create parent directories before calling git worktree add", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      const workspacePath = args[args.length - 1];
      const parentDir = join(workspacePath, "..");
      if (!existsSync(parentDir)) {
        throw new Error(`Cannot access ${workspacePath}`);
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace(tmp, "oneshot-12345", execGit);
    expect((r as any).error).toBeUndefined();
    const worktreeCall = calls.find((args) => args.includes("worktree") && args.includes("add"));
    expect(worktreeCall).toBeDefined();
    expect(worktreeCall).toContain("--detach");
    expect(worktreeCall?.[worktreeCall.length - 1]).toContain(".megapowers/workspaces/");
  });
});
