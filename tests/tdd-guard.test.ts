import { describe, it, expect } from "bun:test";
import { isTestFile, isAllowlisted } from "../extensions/megapowers/tdd-guard.js";

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
