import { describe, it, expect } from "bun:test";
import {
  buildWorkspaceName,
  buildWorkspaceAddArgs,
  buildWorkspaceForgetArgs,
  buildWorkspaceSquashArgs,
  buildDiffSummaryArgs,
  buildDiffFullArgs,
  workspacePath,
} from "../extensions/megapowers/subagent/subagent-workspace.js";

describe("buildWorkspaceName", () => {
  it("creates workspace name from subagent ID", () => {
    expect(buildWorkspaceName("sa-abc123")).toBe("mega-sa-abc123");
  });
});

describe("workspacePath", () => {
  it("returns path under .megapowers/subagents/<id>/workspace", () => {
    expect(workspacePath("/project", "sa-abc")).toBe("/project/.megapowers/subagents/sa-abc/workspace");
  });
});

describe("buildWorkspaceAddArgs", () => {
  it("returns jj workspace add args with name and target path", () => {
    const args = buildWorkspaceAddArgs("mega-sa-abc", "/project/.megapowers/subagents/sa-abc/workspace");
    expect(args).toEqual(["workspace", "add", "--name", "mega-sa-abc", "/project/.megapowers/subagents/sa-abc/workspace"]);
  });
});

describe("buildWorkspaceForgetArgs", () => {
  it("returns jj workspace forget args", () => {
    expect(buildWorkspaceForgetArgs("mega-sa-abc")).toEqual(["workspace", "forget", "mega-sa-abc"]);
  });
});

describe("buildWorkspaceSquashArgs", () => {
  it("returns jj squash args from workspace into current change", () => {
    expect(buildWorkspaceSquashArgs("mega-sa-abc")).toEqual(["squash", "--from", "mega-sa-abc@"]);
  });
});

describe("buildDiffSummaryArgs", () => {
  it("returns jj diff --summary args", () => {
    expect(buildDiffSummaryArgs()).toEqual(["diff", "--summary"]);
  });
});

describe("buildDiffFullArgs", () => {
  it("returns jj diff args for full patch", () => {
    expect(buildDiffFullArgs()).toEqual(["diff"]);
  });
});

describe("cleanup contract", () => {
  it("buildWorkspaceForgetArgs produces valid cleanup command for any workspace name", () => {
    const names = ["mega-sa-001", "mega-sa-t3-abc12345", "mega-sa-timeout"];
    for (const name of names) {
      const args = buildWorkspaceForgetArgs(name);
      expect(args).toEqual(["workspace", "forget", name]);
    }
  });
});
