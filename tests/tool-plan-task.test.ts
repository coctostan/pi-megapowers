import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanTask } from "../extensions/megapowers/tools/tool-plan-task.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { readPlanTask } from "../extensions/megapowers/state/plan-store.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

describe("handlePlanTask — create", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error when not in plan phase", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is review", () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("review");
  });

  it("creates a task file in draft mode with all defaults", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "First task", description: "Task body content." });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Task 1");
    expect(result.message).toContain("First task");

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.id).toBe(1);
    expect(doc.data.title).toBe("First task");
    expect(doc.data.status).toBe("draft");
    expect(doc.data.depends_on).toEqual([]);
    expect(doc.data.no_test).toBe(false);
    expect(doc.data.files_to_modify).toEqual([]);
    expect(doc.data.files_to_create).toEqual([]);
    expect(doc.content).toBe("Task body content.");
  });

  it("returns validation error when title is missing on create", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("title");
  });

  it("returns validation error when description is missing on create", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("description");
  });

  it("creates a task with explicit optional fields", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, {
      id: 2,
      title: "Second",
      description: "Body.",
      depends_on: [1],
      no_test: true,
      files_to_modify: ["src/foo.ts"],
      files_to_create: ["src/bar.ts"],
    });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(doc.data.depends_on).toEqual([1]);
    expect(doc.data.no_test).toBe(true);
    expect(doc.data.files_to_modify).toEqual(["src/foo.ts"]);
    expect(doc.data.files_to_create).toEqual(["src/bar.ts"]);
  });

  it("create response includes title, file path, and change summary", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "B" });
    expect(result.message).toContain('"T"');
    expect(result.message).toContain("task-001.md");
    expect(result.message).toContain("Changed:");
  });

});


describe("handlePlanTask — update (partial merge)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-update-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("merges only provided fields, preserving existing values", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "Original", description: "Original body.", depends_on: [2] });

    const result = handlePlanTask(tmp, { id: 1, depends_on: [2, 3] });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.title).toBe("Original");
    expect(doc.data.depends_on).toEqual([2, 3]);
    expect(doc.content).toBe("Original body.");
  });

  it("replaces body when description is provided in update", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "Old body." });

    const result = handlePlanTask(tmp, { id: 1, description: "New body." });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.content).toBe("New body.");
  });

  it("preserves body when description is omitted in update", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "Keep this body." });

    const result = handlePlanTask(tmp, { id: 1, title: "Updated title" });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.title).toBe("Updated title");
    expect(doc.content).toBe("Keep this body.");
  });

  it("update response includes title, file path, and changed field list", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "B." });
    const result = handlePlanTask(tmp, { id: 1, depends_on: [1, 2] });
    expect(result.message).toContain('"T"');
    expect(result.message).toContain("task-001.md");
    expect(result.message).toContain("Changed:");
    expect(result.message).toContain("depends_on");
  });

  it("works in revise mode (updates existing task)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "B." });

    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const result = handlePlanTask(tmp, { id: 1, no_test: true });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.no_test).toBe(true);
  });

  it("returns error when existing task file is corrupt (parse failure)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    // Write a corrupt task file (invalid frontmatter) at the expected path
    const taskDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, "task-001.md"), "---\nnot_a_field: bad\n---\nBody");

    // Should return an error, not silently overwrite the file
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("corrupt");
  });
});
