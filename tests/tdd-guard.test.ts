import { describe, it, expect } from "bun:test";
import {
  isTestFile, isAllowlisted, isTestRunnerCommand, handleTestResult,
  checkFileWrite, type TddState, type TddTaskState, type FileWriteResult,
} from "../extensions/megapowers/tdd-guard.js";
import type { PlanTask } from "../extensions/megapowers/state-machine.js";

function makeTask(overrides: Partial<PlanTask> = {}): PlanTask {
  return { index: 1, description: "Implement feature", completed: false, noTest: false, ...overrides };
}

function makeTaskState(overrides: Partial<TddTaskState> = {}): TddTaskState {
  return { taskIndex: 1, state: "no-test", skipped: false, ...overrides };
}

describe("isTestFile", () => {
  it("matches *.test.ts files", () => {
    expect(isTestFile("src/auth.test.ts")).toBe(true);
  });

  it("matches *.spec.ts files", () => {
    expect(isTestFile("src/auth.spec.ts")).toBe(true);
  });

  it("matches *.test.js files", () => {
    expect(isTestFile("lib/utils.test.js")).toBe(true);
  });

  it("matches files in tests/ directory", () => {
    expect(isTestFile("tests/auth.ts")).toBe(true);
  });

  it("matches files in test/ directory", () => {
    expect(isTestFile("test/auth.ts")).toBe(true);
  });

  it("matches files in __tests__/ directory", () => {
    expect(isTestFile("src/__tests__/auth.ts")).toBe(true);
  });

  it("does not match regular source files", () => {
    expect(isTestFile("src/auth.ts")).toBe(false);
  });

  it("does not match files with test in the name but not the pattern", () => {
    expect(isTestFile("src/test-utils.ts")).toBe(false);
  });
});

describe("isAllowlisted", () => {
  it("allows .json files", () => {
    expect(isAllowlisted("tsconfig.json")).toBe(true);
  });

  it("allows .yaml files", () => {
    expect(isAllowlisted("config.yaml")).toBe(true);
  });

  it("allows .yml files", () => {
    expect(isAllowlisted("docker-compose.yml")).toBe(true);
  });

  it("allows .toml files", () => {
    expect(isAllowlisted("pyproject.toml")).toBe(true);
  });

  it("allows .env files", () => {
    expect(isAllowlisted(".env")).toBe(true);
    expect(isAllowlisted(".env.local")).toBe(true);
  });

  it("allows .d.ts files", () => {
    expect(isAllowlisted("src/types.d.ts")).toBe(true);
  });

  it("allows .md files", () => {
    expect(isAllowlisted("README.md")).toBe(true);
  });

  it("allows .config.* files", () => {
    expect(isAllowlisted("vite.config.ts")).toBe(true);
    expect(isAllowlisted("jest.config.js")).toBe(true);
  });

  it("does not allow regular source files", () => {
    expect(isAllowlisted("src/auth.ts")).toBe(false);
    expect(isAllowlisted("lib/utils.js")).toBe(false);
  });
});

describe("isTestRunnerCommand", () => {
  it("matches 'bun test'", () => {
    expect(isTestRunnerCommand("bun test")).toBe(true);
  });

  it("matches 'bun test' with arguments", () => {
    expect(isTestRunnerCommand("bun test tests/auth.test.ts -v")).toBe(true);
  });

  it("matches 'npm test'", () => {
    expect(isTestRunnerCommand("npm test")).toBe(true);
  });

  it("matches 'npx jest'", () => {
    expect(isTestRunnerCommand("npx jest")).toBe(true);
  });

  it("matches 'npx vitest'", () => {
    expect(isTestRunnerCommand("npx vitest run")).toBe(true);
  });

  it("matches 'pytest'", () => {
    expect(isTestRunnerCommand("pytest tests/")).toBe(true);
  });

  it("matches 'python -m pytest'", () => {
    expect(isTestRunnerCommand("python -m pytest")).toBe(true);
  });

  it("matches 'cargo test'", () => {
    expect(isTestRunnerCommand("cargo test")).toBe(true);
  });

  it("matches 'go test'", () => {
    expect(isTestRunnerCommand("go test ./...")).toBe(true);
  });

  it("matches 'deno test'", () => {
    expect(isTestRunnerCommand("deno test")).toBe(true);
  });

  it("matches 'npm run test'", () => {
    expect(isTestRunnerCommand("npm run test")).toBe(true);
  });

  it("matches 'npx mocha'", () => {
    expect(isTestRunnerCommand("npx mocha")).toBe(true);
  });

  it("does not match unrelated commands", () => {
    expect(isTestRunnerCommand("ls -la")).toBe(false);
    expect(isTestRunnerCommand("cat test.txt")).toBe(false);
    expect(isTestRunnerCommand("npm install")).toBe(false);
  });

  it("does not match test runners embedded in other commands", () => {
    expect(isTestRunnerCommand("echo bun test")).toBe(false);
    expect(isTestRunnerCommand("echo 'npm test' && false")).toBe(false);
  });

  it("does not match compound commands with test runners", () => {
    expect(isTestRunnerCommand("bun test && bun run lint")).toBe(false);
    expect(isTestRunnerCommand("npm test && npm run build")).toBe(false);
    expect(isTestRunnerCommand("bun test; echo done")).toBe(false);
    expect(isTestRunnerCommand("cargo test | grep FAILED")).toBe(false);
  });

  it("does not match multiline compound commands", () => {
    expect(isTestRunnerCommand("bun test\nfalse")).toBe(false);
    expect(isTestRunnerCommand("bun test\necho done")).toBe(false);
  });
});

describe("handleTestResult", () => {
  it("advances test-written to impl-allowed on non-zero exit", () => {
    expect(handleTestResult(1, "test-written")).toBe("impl-allowed");
  });

  it("stays at test-written on zero exit (tests pass = not a failing test)", () => {
    expect(handleTestResult(0, "test-written")).toBe("test-written");
  });

  it("does not change no-test state", () => {
    expect(handleTestResult(1, "no-test")).toBe("no-test");
  });

  it("does not change impl-allowed state", () => {
    expect(handleTestResult(1, "impl-allowed")).toBe("impl-allowed");
  });
});

describe("checkFileWrite", () => {
  it("allows writes when not in implement phase", () => {
    const result = checkFileWrite("src/auth.ts", null, makeTask(), makeTaskState());
    expect(result.allow).toBe(true);
  });

  it("allows allowlisted files regardless of state", () => {
    const result = checkFileWrite("tsconfig.json", "implement", makeTask(), makeTaskState());
    expect(result.allow).toBe(true);
  });

  it("allows test file writes and advances state to test-written", () => {
    const taskState = makeTaskState({ state: "no-test" });
    const result = checkFileWrite("tests/auth.test.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
    expect(result.newState).toBe("test-written");
  });

  it("allows production writes when state is impl-allowed", () => {
    const taskState = makeTaskState({ state: "impl-allowed" });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
  });

  it("blocks production writes when state is no-test", () => {
    const taskState = makeTaskState({ state: "no-test" });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("TDD violation");
  });

  it("blocks production writes when state is test-written", () => {
    const taskState = makeTaskState({ state: "test-written" });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("TDD violation");
  });

  it("passes through when task has noTest: true", () => {
    const task = makeTask({ noTest: true });
    const taskState = makeTaskState({ state: "no-test" });
    const result = checkFileWrite("src/auth.ts", "implement", task, taskState);
    expect(result.allow).toBe(true);
  });

  it("passes through when task state is skipped", () => {
    const taskState = makeTaskState({ state: "no-test", skipped: true });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
  });

  it("keeps state at test-written when writing more test files", () => {
    const taskState = makeTaskState({ state: "test-written" });
    const result = checkFileWrite("tests/auth-2.test.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
    expect(result.newState).toBeUndefined();
  });
});
