import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  handleSubagentDispatch,
  handleSubagentStatus,
  type SubagentDispatchInput,
} from "../extensions/megapowers/subagent-tools.js";
import { writeSubagentStatus } from "../extensions/megapowers/subagent-status.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("handleSubagentDispatch", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-tools-test-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error when megapowers is disabled", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });
    const result = await handleSubagentDispatch(tmp, { task: "Do thing" });
    expect(result.error).toContain("disabled");
  });

  it("returns error when no active issue", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = await handleSubagentDispatch(tmp, { task: "Do thing" });
    expect(result.error).toContain("No active issue");
  });

  it("returns error with install instructions when jj is not available", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Do thing" }, {
      isJJRepo: async () => false,
    });
    expect(result.error).toContain("jj");
    expect(result.error).toContain("brew install jj");
    expect(result.error).toContain("cargo install jj-cli");
    expect(result.error).toContain("jj git init --colocate");
  });

  it("returns error when agent name is unknown", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Do thing", agent: "unknown-agent-xyz" }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toContain("Agent 'unknown-agent-xyz' not found");
  });

  it("returns error for invalid timeoutMs", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Do thing", timeoutMs: 0 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toContain("timeoutMs");
  });

  it("returns subagent ID on successful dispatch", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Build the parser" }, {
      isJJRepo: async () => true,
    });
    expect(result.id).toBeDefined();
    expect(result.id).toMatch(/^sa-/);
    expect(result.error).toBeUndefined();
  });

  it("includes task index in ID when taskIndex is provided", async () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: Setup\n\n### Task 2: Build\n");

    const result = await handleSubagentDispatch(tmp, { task: "Build", taskIndex: 2 }, {
      isJJRepo: async () => true,
    });
    expect(result.id).toMatch(/^sa-t2-/);
  });

  it("blocks dispatch when task dependencies are not met", async () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: A\n\n### Task 2: B [depends: 1]\n");

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      completedTasks: [],
    });

    const result = await handleSubagentDispatch(tmp, { task: "Build B", taskIndex: 2 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toContain("depend");
  });

  it("returns error when taskIndex provided but no plan tasks found", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Do thing", taskIndex: 1 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toContain("No tasks");
  });

  it("allows dispatch when task dependencies are met", async () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: A\n\n### Task 2: B [depends: 1]\n");

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      completedTasks: [1],
    });

    const result = await handleSubagentDispatch(tmp, { task: "Build B", taskIndex: 2 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
  });

  it("persists agent system prompt to disk and includes systemPromptPath in config", async () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: test-model\nthinking: full\n---\nYou are a custom worker.`);

    const result = await handleSubagentDispatch(tmp, { task: "Build thing", agent: "worker" }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toBeUndefined();
    expect(result.config!.systemPromptPath).toBeDefined();
    expect(result.config!.thinking).toBe("full");

    const promptContent = readFileSync(result.config!.systemPromptPath!, "utf-8");
    expect(promptContent).toBe("You are a custom worker.");
  });

  it("writes prompt to file instead of passing inline", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Build the parser" }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toBeUndefined();
    const promptPath = join(tmp, ".megapowers", "subagents", result.id!, "prompt.md");
    expect(existsSync(promptPath)).toBe(true);
    const promptContent = readFileSync(promptPath, "utf-8");
    expect(promptContent).toContain("Build the parser");
  });

  it("returns DispatchConfig for spawning", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "test" }, {
      isJJRepo: async () => true,
    });
    expect(result.config).toBeDefined();
    expect(result.config!.id).toBe(result.id!);
    expect(result.config!.workspacePath).toContain(".megapowers/subagents");
  });
});

describe("handleSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-status-tool-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error for nonexistent subagent", () => {
    const result = handleSubagentStatus(tmp, "nonexistent");
    expect(result.error).toContain("not found");
  });

  it("returns status for running subagent", () => {
    writeSubagentStatus(tmp, "sa-001", {
      id: "sa-001",
      state: "running",
      turnsUsed: 3,
      startedAt: 1000,
    });
    const result = handleSubagentStatus(tmp, "sa-001");
    expect(result.status).toBeDefined();
    expect(result.status!.state).toBe("running");
    expect(result.status!.turnsUsed).toBe(3);
  });

  it("returns diff for completed subagent", () => {
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "completed",
      turnsUsed: 5,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/foo.ts"],
      diff: "--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1 +1 @@\n-old\n+new",
      testsPassed: true,
    });
    const result = handleSubagentStatus(tmp, "sa-002");
    expect(result.status!.state).toBe("completed");
    expect(result.status!.diff).toContain("src/foo.ts");
    expect(result.status!.filesChanged).toEqual(["src/foo.ts"]);
  });

  it("returns error info for failed subagent", () => {
    writeSubagentStatus(tmp, "sa-003", {
      id: "sa-003",
      state: "failed",
      turnsUsed: 2,
      startedAt: 1000,
      completedAt: 1500,
      error: "Process exited with code 1",
    });
    const result = handleSubagentStatus(tmp, "sa-003");
    expect(result.status!.state).toBe("failed");
    expect(result.status!.error).toContain("exit");
  });

  it("returns detected errors for stuck subagent", () => {
    writeSubagentStatus(tmp, "sa-004", {
      id: "sa-004",
      state: "failed",
      turnsUsed: 8,
      startedAt: 1000,
      completedAt: 5000,
      detectedErrors: ["TypeError: x is not a function"],
    });
    const result = handleSubagentStatus(tmp, "sa-004");
    expect(result.status!.detectedErrors).toEqual(["TypeError: x is not a function"]);
  });
});

describe("subagent available in all phases", () => {
  const phases = ["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "reproduce", "diagnose"] as const;

  for (const phase of phases) {
    it(`handleSubagentDispatch works in ${phase} phase`, async () => {
      const tmp = mkdtempSync(join(tmpdir(), `phase-${phase}-`));
      const workflow = ["reproduce", "diagnose"].includes(phase) ? "bugfix" : "feature";
      writeState(tmp, {
        ...createInitialState(),
        activeIssue: "001-test",
        workflow: workflow as any,
        phase: phase as any,
        megaEnabled: true,
      });
      const result = await handleSubagentDispatch(tmp, { task: "Do thing" }, {
        isJJRepo: async () => true,
      });
      expect(result.error).toBeUndefined();
      expect(result.id).toBeDefined();
      rmSync(tmp, { recursive: true, force: true });
    });
  }
});

describe("satellite TDD enforcement", () => {
  it("sets PI_SUBAGENT=1 in spawn env for TDD enforcement", async () => {
    const { isSatelliteMode } = await import("../extensions/megapowers/satellite.js");
    const { buildSpawnEnv: buildEnv } = await import("../extensions/megapowers/subagent-runner.js");

    const env = buildEnv({ subagentId: "sa-test" });
    expect(isSatelliteMode({ isTTY: false, env })).toBe(true);
  });

  it("sets MEGA_PROJECT_ROOT so satellite can read state", async () => {
    const { buildSpawnEnv: buildEnv } = await import("../extensions/megapowers/subagent-runner.js");
    const { resolveProjectRoot } = await import("../extensions/megapowers/satellite.js");

    const env = buildEnv({ subagentId: "sa-test", projectRoot: "/my/project" });
    const root = resolveProjectRoot("/workspace/sa-test/workspace", env);
    expect(root).toBe("/my/project");
  });
});

describe("no auto-squash", () => {
  it("handleSubagentStatus returns diff without squashing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "no-squash-"));
    writeSubagentStatus(tmp, "sa-nosquash", {
      id: "sa-nosquash",
      state: "completed",
      turnsUsed: 3,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/a.ts"],
      diff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new",
      testsPassed: true,
    });

    const result = handleSubagentStatus(tmp, "sa-nosquash");
    expect(result.status!.state).toBe("completed");
    expect(result.status!.diff).toContain("src/a.ts");
    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("subagent_status returns JSON", () => {
  it("status result is structured data, not just human text", () => {
    const tmp = mkdtempSync(join(tmpdir(), "json-status-"));
    writeSubagentStatus(tmp, "sa-json", {
      id: "sa-json",
      state: "completed",
      turnsUsed: 4,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/x.ts"],
      diff: "M src/x.ts",
      testsPassed: true,
    });
    const result = handleSubagentStatus(tmp, "sa-json");
    expect(result.status).toBeDefined();
    expect(typeof result.status!.state).toBe("string");
    expect(typeof result.status!.turnsUsed).toBe("number");
    expect(Array.isArray(result.status!.filesChanged)).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("mega off disables subagent dispatch", () => {
  it("returns error when megaEnabled is false", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "mega-off-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: false,
    });
    const result = await handleSubagentDispatch(tmp, { task: "test" });
    expect(result.error).toContain("disabled");
    rmSync(tmp, { recursive: true, force: true });
  });
});
