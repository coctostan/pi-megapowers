import { describe, it, expect } from "bun:test";
// Task 9: createPR tests
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
