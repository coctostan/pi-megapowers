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
    const result = handlePlanTask(tmp, { id: 1, title: "First task", description: "A".repeat(200), files_to_modify: ["src/foo.ts"] });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Task 1");
    expect(result.message).toContain("First task");

    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.id).toBe(1);
    expect(doc.data.title).toBe("First task");
    expect(doc.data.status).toBe("draft");
    expect(doc.data.depends_on).toEqual([]);
    expect(doc.data.no_test).toBe(false);
    expect(doc.data.files_to_modify).toEqual(["src/foo.ts"]);
    expect(doc.data.files_to_create).toEqual([]);
    expect(doc.content).toBe("A".repeat(200));
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
      description: "A".repeat(200),
      depends_on: [],
      no_test: true,
      files_to_modify: ["src/foo.ts"],
      files_to_create: ["src/bar.ts"],
    });
    expect(result.error).toBeUndefined();

    const doc = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(doc.data.depends_on).toEqual([]);
    expect(doc.data.no_test).toBe(true);
    expect(doc.data.files_to_modify).toEqual(["src/foo.ts"]);
    expect(doc.data.files_to_create).toEqual(["src/bar.ts"]);
  });

  it("create response includes title, file path, and change summary", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
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
    handlePlanTask(tmp, { id: 1, title: "Original", description: "A".repeat(200), files_to_modify: ["src/a.ts"] });

    const result = handlePlanTask(tmp, { id: 1, files_to_modify: ["src/a.ts", "src/b.ts"] });
    expect(result.error).toBeUndefined();
    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.title).toBe("Original");
    expect(doc.data.files_to_modify).toEqual(["src/a.ts", "src/b.ts"]);
    expect(doc.content).toBe("A".repeat(200));
  });

  it("replaces body when description is provided in update", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });

    const result = handlePlanTask(tmp, { id: 1, description: "A".repeat(200) + "extra" });
    expect(result.error).toBeUndefined();
    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.content).toBe("A".repeat(200) + "extra");
  });

  it("preserves body when description is omitted in update", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    const result = handlePlanTask(tmp, { id: 1, title: "Updated title" });
    expect(result.error).toBeUndefined();
    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.title).toBe("Updated title");
    expect(doc.content).toBe("A".repeat(200));
  });

  it("update response includes title, file path, and changed field list", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    const result = handlePlanTask(tmp, { id: 1, files_to_modify: ["src/t.ts", "src/u.ts"] });
    expect(result.message).toContain('"T"');
    expect(result.message).toContain("task-001.md");
    expect(result.message).toContain("Changed:");
    expect(result.message).toContain("files_to_modify");
  });

  it("works in revise mode (updates existing task)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const result = handlePlanTask(tmp, { id: 1, no_test: true });
    expect(result.error).toBeUndefined();
    const doc = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    expect(doc.data.no_test).toBe(true);
  })

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

describe("handlePlanTask — T0 lint integration", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-lint-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects create when description is shorter than 200 characters", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "Valid title",
      description: "too short",
      files_to_modify: ["src/foo.ts"],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Description must be at least 200 characters");
    expect(readPlanTask(tmp, "001-test", 1)).toBeNull();
  });

  it("returns all lint errors in one aggregated response", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "   ",
      description: "short",
      files_to_modify: [],
      files_to_create: [],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Title must not be empty");
    expect(result.error).toContain("Description must be at least 200 characters");
    expect(result.error).toContain("Task must specify at least one file");
  });

  it("rejects update when merged task fails lint", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const created = handlePlanTask(tmp, {
      id: 1,
      title: "Valid",
      description: "A".repeat(200),
      files_to_modify: ["src/a.ts"],
    });
    expect(created.error).toBeUndefined();

    const result = handlePlanTask(tmp, {
      id: 1,
      files_to_modify: [],
      files_to_create: [],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Task must specify at least one file");
  });

  it("allows valid task to be saved", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "Valid task",
      description: "A".repeat(220),
      files_to_modify: ["src/foo.ts"],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Task 1");
  });
});
