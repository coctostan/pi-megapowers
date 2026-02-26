import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateWriteOverride, recordTestFileWritten } from "../extensions/megapowers/tools/tool-overrides.js";
import { canWrite } from "../extensions/megapowers/policy/write-policy.js";
import { readFileSync } from "node:fs";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

// --- helpers ---

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function writeArtifact(tmp: string, issue: string, filename: string, content: string) {
  const dir = join(tmp, ".megapowers", "plans", issue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

// =============================================================================
// evaluateWriteOverride
// =============================================================================

describe("evaluateWriteOverride", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "write-override-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows writes when megaEnabled is false (passthrough)", () => {
    setState(tmp, { phase: "spec", megaEnabled: false });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("blocks source code writes in spec phase", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("allows .megapowers/ writes in spec phase", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = evaluateWriteOverride(tmp, ".megapowers/plans/001/spec.md");
    expect(result.allowed).toBe(true);
  });

  it("allows test files freely in implement phase, sets updateTddState", () => {
    setState(tmp, { phase: "implement", megaEnabled: true });
    const result = evaluateWriteOverride(tmp, "tests/foo.test.ts");
    expect(result.allowed).toBe(true);
    expect(result.updateTddState).toBe(true);
  });

  it("blocks production files when TDD not met in implement", () => {
    setState(tmp, { phase: "implement", megaEnabled: true, tddTaskState: null });
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(false);
  });

  it("allows production files when TDD is impl-allowed", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("allows when phase is null (no workflow active)", () => {
    writeState(tmp, createInitialState());
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("allows allowlisted files (config, json, md) without TDD in implement", () => {
    setState(tmp, { phase: "implement", megaEnabled: true, tddTaskState: null });
    expect(evaluateWriteOverride(tmp, "tsconfig.json").allowed).toBe(true);
    expect(evaluateWriteOverride(tmp, "README.md").allowed).toBe(true);
    expect(evaluateWriteOverride(tmp, ".env").allowed).toBe(true);
  });

  it("does NOT set updateTddState for non-test files", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
    expect(result.updateTddState).toBeFalsy();
  });
});

// =============================================================================
// recordTestFileWritten
// =============================================================================

describe("recordTestFileWritten", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "record-tdd-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets tddTaskState to test-written with correct taskIndex (PlanTask.index)", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      currentTaskIndex: 0,
      tddTaskState: null,
    });
    recordTestFileWritten(tmp);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written");
    expect(state.tddTaskState?.taskIndex).toBe(1); // PlanTask.index for Task 1 (1-based)
  });

  it("uses second task's index when currentTaskIndex is 1", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      currentTaskIndex: 1,
      tddTaskState: null,
    });
    recordTestFileWritten(tmp);
    const state = readState(tmp);
    expect(state.tddTaskState?.taskIndex).toBe(2); // PlanTask.index for Task 2
  });

  it("does not change state when no active issue", () => {
    writeState(tmp, createInitialState()); // no activeIssue
    recordTestFileWritten(tmp);
    const state = readState(tmp);
    expect(state.tddTaskState).toBeNull();
  });
});

// =============================================================================
// exports
// =============================================================================

describe("tool-overrides exports", () => {
  it("does not export processBashResult", async () => {
    const mod = await import("../extensions/megapowers/tools/tool-overrides.js");
    expect((mod as any).processBashResult).toBeUndefined();
  });

  it("write-policy does not export isTestRunnerCommand", async () => {
    const mod = await import("../extensions/megapowers/policy/write-policy.js");
    expect((mod as any).isTestRunnerCommand).toBeUndefined();
  });
});

describe("bugfix reproduce/diagnose write policy (behavioral equivalence)", () => {
  it("allows source code writes during reproduce phase", () => {
    const result = canWrite("reproduce", "src/app.ts", true, false, null);
    expect(result.allowed).toBe(true);
  });

  it("allows source code writes during diagnose phase", () => {
    const result = canWrite("diagnose", "src/app.ts", true, false, null);
    expect(result.allowed).toBe(true);
  });
});

describe("write-policy.ts refactor verification", () => {
  it("uses workflow config (no hardcoded phase sets)", () => {
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "policy", "write-policy.ts"),
      "utf-8",
    );
    expect(source).toContain("getAllWorkflowConfigs");
    expect(source).not.toContain('"brainstorm", "spec", "plan", "review", "verify", "done"');
  });
});
