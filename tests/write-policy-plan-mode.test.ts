import { describe, it, expect } from "bun:test";
import { canWrite } from "../extensions/megapowers/policy/write-policy.js";
import type { PlanMode } from "../extensions/megapowers/state/state-machine.js";

describe("canWrite — plan mode awareness", () => {
  const taskFilePath = ".megapowers/plans/001-test/tasks/task-001.md";
  const nonTaskMegaPath = ".megapowers/plans/001-test/spec.md";
  const sourceFilePath = "src/foo.ts";

  it("blocks write/edit to task files in draft mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "draft");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("task");
  });

  it("blocks write/edit to task files in review mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "review");
    expect(result.allowed).toBe(false);
  });

  it("allows edit to task files in revise mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "revise", "edit");
    expect(result.allowed).toBe(true);
  });

  it("blocks write (not edit) to task files in revise mode", () => {
    const result = canWrite("plan", taskFilePath, true, false, null, "revise", "write");
    expect(result.allowed).toBe(false);
  });

  it("allows non-task .megapowers/ paths in all plan modes", () => {
    for (const mode of ["draft", "review", "revise"] as PlanMode[]) {
      const result = canWrite("plan", nonTaskMegaPath, true, false, null, mode);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks source code writes in plan phase (blocking phase)", () => {
    const result = canWrite("plan", sourceFilePath, true, false, null, "draft");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("ignores planMode for non-plan phases", () => {
    const result = canWrite("implement", taskFilePath, true, false, null, null);
    // implement is a TDD phase, task file is in .megapowers/ — allowed
    expect(result.allowed).toBe(true);
  });
});
