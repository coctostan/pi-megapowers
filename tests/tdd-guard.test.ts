import { describe, it, expect } from "bun:test";
import { isTestFile, isAllowlisted, isTestRunnerCommand, handleTestResult, type TddState } from "../extensions/megapowers/tdd-guard.js";

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
