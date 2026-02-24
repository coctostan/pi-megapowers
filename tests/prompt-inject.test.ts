import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

describe("buildInjectedPrompt", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null when megaEnabled is false", () => {
    setState(tmp, { phase: "spec", megaEnabled: false });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  // AC1: enabled + no active issue → base.md content
  it("returns base.md content when megaEnabled but no active issue", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("Getting Started");
    expect(result).toContain("/issue");
    expect(result).toContain("megapowers_signal");
  });

  // AC2: disabled → null even with active issue
  it("returns null when megaEnabled is false even with active issue", () => {
    setState(tmp, { phase: "spec", megaEnabled: false, activeIssue: "001-test" });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  // AC3: enabled + active issue → phase prompt (not base.md)
  it("returns phase prompt (not base.md) when issue is active", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).not.toContain("Getting Started");
    expect(result).toContain("executable specification");
  });

  it("includes megapowers protocol section with tool descriptions", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_signal");
    expect(result).toContain("megapowers_save_artifact");
  });

  it("includes phase-specific tool instructions for spec phase (AC42)", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("megapowers_save_artifact");
    expect(result).toContain("spec");
  });

  it("includes phase-specific tool instructions for implement phase (AC42)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    const dir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build it\n\n### Task 2: Test it\n");
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("Task 1");
    expect(result).toContain("task_done");
  });

  it("includes phase-specific tool instructions for review phase (AC42)", () => {
    setState(tmp, { phase: "review", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("review_approve");
  });

  it("includes phase_next instructions for brainstorm phase (AC42)", () => {
    setState(tmp, { phase: "brainstorm", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("phase_next");
  });
});
