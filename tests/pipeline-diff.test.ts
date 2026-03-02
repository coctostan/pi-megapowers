import { describe, it, expect } from "bun:test";
import { getWorkspaceDiff, type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("getWorkspaceDiff", () => {
  it("getWorkspaceDiff stages changes before diffing", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("--stat")) return { stdout: "a.ts | 2 ++\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) {
        return { stdout: "patch content", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const result = await getWorkspaceDiff("/ws", execGit);
    expect(result.diff).toBe("patch content");

    const addIdx = calls.findIndex((c) => c[0] === "-C" && c[1] === "/ws" && c[2] === "add");
    const statIdx = calls.findIndex((c) => c.includes("--stat"));
    const diffIdx = calls.findIndex((c) => c.includes("diff") && c.includes("--cached") && !c.includes("--stat"));
    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(statIdx).toBeGreaterThan(addIdx);
    expect(diffIdx).toBeGreaterThan(statIdx);
  });
});
