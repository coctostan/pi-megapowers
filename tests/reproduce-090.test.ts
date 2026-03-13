/**
 * Reproduction tests for batch issue 090:
 *   #088 — phase_next during plan phase bypasses plan review gate
 *   #089 — deriveTasks only reads legacy plan.md, ignores task files
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { advancePhase } from "../extensions/megapowers/policy/phase-advance.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { checkGate } from "../extensions/megapowers/policy/gates.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { deriveTasks } from "../extensions/megapowers/state/derived.js";
import { extractPlanTasks } from "../extensions/megapowers/plan-parser.js";
import { writePlanTask } from "../extensions/megapowers/state/plan-store.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

describe("Issue #088: phase_next bypasses plan review gate", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repro-088-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });
  function writeArtifact(issue: string, filename: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), content);
  }
  function setState(overrides: Partial<MegapowersState>) {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      ...overrides,
    });
  }

  function writeTask(issue = "001-test") {
    writePlanTask(
      tmp,
      issue,
      {
        id: 1,
        title: "Do something",
        status: "approved",
        depends_on: [],
        no_test: false,
        files_to_modify: [],
        files_to_create: [],
      },
      "Task body",
    );
  }

  it("phase_next rejects plan→implement when planMode is 'draft' (no review happened)", () => {
    setState({
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
    });
    writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");
    writeTask();

    const result = advancePhase(tmp);

    expect(result.ok).toBe(false);
  });

  it("phase_next rejects plan→implement when planMode is 'revise' (after revise, before re-review)", () => {
    setState({
      phase: "plan",
      planMode: "revise",
      planIteration: 2,
    });
    writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");
    writeTask();

    const result = advancePhase(tmp);

    expect(result.ok).toBe(false);
  });

  it("gate check for plan→implement blocks when planMode is draft", () => {
    const store = createStore(tmp);
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
    };
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Do something\n");
    writeTask();
    const result = checkGate(state, "implement", store, tmp);

    expect(result.pass).toBe(false);
  });

  it("phase_next allows plan→implement when planMode is null (review completed)", () => {
    setState({
      phase: "plan",
      planMode: null,
      planIteration: 1,
    });
    writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");
    writeTask();

    const result = advancePhase(tmp);

    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
  });
});

describe("Issue #089: deriveTasks ignores task files", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repro-089-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeArtifact(issue: string, filename: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), content);
  }

  it("deriveTasks returns tasks when plan.md uses ## Task N — format", () => {
    writeArtifact("001-test", "plan.md",
      "# Plan\n\n" +
      "## Task 1 — Set up the database schema\n\n" +
      "Create tables for users and roles.\n\n" +
      "## Task 2 — Implement API endpoints\n\n" +
      "Build REST endpoints.\n"
    );

    const tasks = deriveTasks(tmp, "001-test");

    expect(tasks.length).toBe(2);
    expect(tasks[0].index).toBe(1);
    expect(tasks[0].description).toBe("Set up the database schema");
    expect(tasks[1].index).toBe(2);
    expect(tasks[1].description).toBe("Implement API endpoints");
  });

  it("extractPlanTasks accepts ## headers (not just ###)", () => {
    const content = "## Task 1: Set up schema\n## Task 2: Build API\n";
    const tasks = extractPlanTasks(content);

    expect(tasks.length).toBe(2);
    expect(tasks[0].index).toBe(1);
    expect(tasks[1].index).toBe(2);
  });

  it("extractPlanTasks accepts em-dash separator (not just colon)", () => {
    const content = "### Task 1 — Set up schema\n### Task 2 — Build API\n";
    const tasks = extractPlanTasks(content);

    expect(tasks.length).toBe(2);
    expect(tasks[0].description).toBe("Set up schema");
    expect(tasks[1].description).toBe("Build API");
  });

  it("deriveTasks reads task files when they exist (ignoring plan.md)", () => {
    const slug = "001-test";
    const planDir = join(tmp, ".megapowers", "plans", slug);
    mkdirSync(planDir, { recursive: true });
    const task1: PlanTask = { id: 1, title: "Set up schema", status: "approved", depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] };
    const task2: PlanTask = { id: 2, title: "Build API", status: "approved", depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] };
    writePlanTask(tmp, slug, task1, "Create tables for users and roles.");
    writePlanTask(tmp, slug, task2, "Build REST endpoints.");
    writeFileSync(join(planDir, "plan.md"), "# Plan\nSee task files.\n");
    const tasks = deriveTasks(tmp, slug);

    expect(tasks.length).toBe(2);
    expect(tasks[0].index).toBe(1);
    expect(tasks[0].description).toBe("Set up schema");
    expect(tasks[1].index).toBe(2);
    expect(tasks[1].description).toBe("Build API");
  });

  it("deriveTasks falls back to plan.md when no task files exist", () => {
    const slug = "002-fallback";
    const planDir = join(tmp, ".megapowers", "plans", slug);
    mkdirSync(planDir, { recursive: true });

    writeFileSync(join(planDir, "plan.md"), "### Task 1: Do something\n### Task 2: Do another\n");

    const tasks = deriveTasks(tmp, slug);
    expect(tasks.length).toBe(2);
    expect(tasks[0].index).toBe(1);
    expect(tasks[1].index).toBe(2);
});

});
