import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  evaluateWriteOverride,
  recordTestFileWritten,
  processBashResult,
} from "../extensions/megapowers/tool-overrides.js";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

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
// processBashResult — uses isError boolean (NOT regex on output text)
// This is the key fix: createBashTool throws on non-zero exit code,
// so the override uses try/catch. isError=true means tests failed (RED).
// =============================================================================

describe("processBashResult", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bash-override-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("transitions test-written → impl-allowed when test command fails (isError=true)", () => {
    // createBashTool throws on non-zero exit → our override catches it → isError=true
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", true); // isError=true: bash threw (non-zero exit)
    expect(readState(tmp).tddTaskState?.state).toBe("impl-allowed");
  });

  it("does NOT transition when test command succeeds (isError=false — tests passed, not failed)", () => {
    // Tests passing means we're still in test-written: need tests to FAIL before impl
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", false); // isError=false: bash resolved (zero exit)
    expect(readState(tmp).tddTaskState?.state).toBe("test-written"); // unchanged
  });

  it("does NOT use regex to detect exit code from output text", () => {
    // Verify the function ignores exit code text in command output
    // The isError flag is what matters, not text like "exit code 1"
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    // isError=false (zero exit) even though it contains "exit code 1" in command string
    processBashResult(tmp, "echo 'exit code 1'", false);
    expect(readState(tmp).tddTaskState?.state).toBe("test-written"); // not changed
  });

  it("ignores non-test-runner commands", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "ls -la", true); // isError=true but not a test command
    expect(readState(tmp).tddTaskState?.state).toBe("test-written"); // unchanged
  });

  it("ignores when phase is not implement or code-review", () => {
    setState(tmp, { phase: "spec", megaEnabled: true, tddTaskState: null });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState).toBeNull();
  });

  it("ignores when megaEnabled is false", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: false,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState?.state).toBe("test-written"); // unchanged
  });

  it("ignores when tddTaskState is not test-written", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState?.state).toBe("no-test"); // unchanged
  });

  it("ignores when tddTaskState is null", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: null,
    });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState).toBeNull();
  });

  it("works for npm test command", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "npm test", true);
    expect(readState(tmp).tddTaskState?.state).toBe("impl-allowed");
  });

  it("works during code-review phase", () => {
    setState(tmp, {
      phase: "code-review",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState?.state).toBe("impl-allowed");
  });

  it("ignores compound commands (chained with ;, &, |)", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    // Compound commands are not considered test runs (security + reliability)
    processBashResult(tmp, "bun test && echo done", true);
    expect(readState(tmp).tddTaskState?.state).toBe("test-written"); // unchanged
  });
});
