import { describe, it, expect } from "bun:test";
import { getWorkspaceDiff, type ExecJJ } from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("getWorkspaceDiff", () => {
  it("gets diff by running jj diff in workspace cwd and parses --summary", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      if (args[0] === "diff" && args[1] === "--summary") return { code: 0, stdout: "M src/a.ts\nA src/b.ts\n", stderr: "" };
      if (args[0] === "diff") return { code: 0, stdout: "diff --git ...", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await getWorkspaceDiff("/project/.megapowers/subagents/pipe-1/workspace", execJJ);
    expect(r.filesChanged).toEqual(["src/a.ts", "src/b.ts"]);
    expect(r.diff).toContain("diff --git");

    expect(calls[0].opts?.cwd).toBe("/project/.megapowers/subagents/pipe-1/workspace");
  });
});
