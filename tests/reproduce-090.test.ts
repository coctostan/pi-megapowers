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

  it("BUG: phase_next advances plan→implement even when planMode is 'draft' (no review happened)", () => {
    // State: we're in plan phase, planMode is "draft" (review hasn't happened yet)
    setState({
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
      reviewApproved: false,
    });
    // plan.md exists (the only gate currently checked)
    writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

    const result = advancePhase(tmp);

    // BUG: This PASSES — plan→implement succeeds without review
    // EXPECTED: This should FAIL because planMode is still "draft"
    // If the bug is fixed, result.ok should be false
    expect(result.ok).toBe(true); // <-- This documents the bug: it should be false
    expect(result.newPhase).toBe("implement");
  });

  it("BUG: phase_next advances plan→implement even when planMode is 'revise' (after revise, before re-review)", () => {
    // State: revise cycle — review happened once, sent back for revisions
    setState({
      phase: "plan",
      planMode: "revise",
      planIteration: 2,
      reviewApproved: false,
    });
    writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

    const result = advancePhase(tmp);

    // BUG: This PASSES — skips the second review entirely
    expect(result.ok).toBe(true); // <-- Should be false
    expect(result.newPhase).toBe("implement");
  });

  it("BUG: gate check for plan→implement only checks requireArtifact, not review approval", () => {
    const store = createStore(tmp);
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
      reviewApproved: false,
    };
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Do something\n");

    const result = checkGate(state, "implement", store, tmp);

    // BUG: Gate passes because it only checks requireArtifact(plan.md)
    expect(result.pass).toBe(true); // <-- Should be false
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

  it("BUG: deriveTasks returns [] when plan.md uses ## Task N — format (not ### Task N:)", () => {
    // This is the format LLMs commonly produce during draft
    writeArtifact("001-test", "plan.md",
      "# Plan\n\n" +
      "## Task 1 — Set up the database schema\n\n" +
      "Create tables for users and roles.\n\n" +
      "## Task 2 — Implement API endpoints\n\n" +
      "Build REST endpoints.\n"
    );

    const tasks = deriveTasks(tmp, "001-test");

    // BUG: Returns [] because extractPlanTasks only matches ### Task N: format
    expect(tasks.length).toBe(0); // <-- Should find 2 tasks
  });

  it("BUG: extractPlanTasks rejects ## headers (requires ###)", () => {
    const content = "## Task 1: Set up schema\n## Task 2: Build API\n";
    const tasks = extractPlanTasks(content);

    // BUG: Only matches ### Task N:, not ## Task N:
    expect(tasks.length).toBe(0); // <-- Should find 2 tasks
  });

  it("BUG: extractPlanTasks rejects em-dash separator (requires colon)", () => {
    const content = "### Task 1 — Set up schema\n### Task 2 — Build API\n";
    const tasks = extractPlanTasks(content);

    // BUG: Only matches ### Task N:, not ### Task N —
    expect(tasks.length).toBe(0); // <-- Should find 2 tasks
  });

  it("BUG: deriveTasks ignores task files even when they exist", () => {
    const slug = "001-test";
    const planDir = join(tmp, ".megapowers", "plans", slug);
    mkdirSync(planDir, { recursive: true });

    // Write task files (the new canonical format)
    const task1: PlanTask = { id: 1, title: "Set up schema", status: "approved" };
    const task2: PlanTask = { id: 2, title: "Build API", status: "approved" };
    writePlanTask(tmp, slug, task1, "Create tables for users and roles.");
    writePlanTask(tmp, slug, task2, "Build REST endpoints.");

    // Write a plan.md with NO parseable tasks (or no plan.md at all)
    writeFileSync(join(planDir, "plan.md"), "# Plan\nSee task files.\n");

    const tasks = deriveTasks(tmp, slug);

    // BUG: deriveTasks only reads plan.md, ignores task files
    // Returns [] because plan.md has no parseable task headers
    expect(tasks.length).toBe(0); // <-- Should find 2 tasks from task files
  });
});
