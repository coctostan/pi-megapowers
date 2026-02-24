import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSaveArtifact } from "../extensions/megapowers/tool-artifact.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

describe("handleSaveArtifact", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-artifact-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  // AC38: megaEnabled=false must block the tool
  describe("AC38 — early-return when megaEnabled is false", () => {
    it("returns error when megaEnabled is false", () => {
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: false });
      const result = handleSaveArtifact(tmp, "spec", "# Spec content");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("disabled");
    });

    it("does NOT write any file when megaEnabled is false", () => {
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: false });
      handleSaveArtifact(tmp, "spec", "# Spec content");
      const path = join(tmp, ".megapowers", "plans", "001-test", "spec.md");
      expect(existsSync(path)).toBe(false);
    });
  });

  describe("happy path — megaEnabled is true", () => {
    it("writes artifact to correct path", () => {
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
      const result = handleSaveArtifact(tmp, "spec", "# My Spec\n\nContent here.");
      expect(result.error).toBeUndefined();

      const path = join(tmp, ".megapowers", "plans", "001-test", "spec.md");
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, "utf-8")).toBe("# My Spec\n\nContent here.");
    });

    it("does not modify state.json", () => {
      const initialState = { ...createInitialState(), activeIssue: "001-test", phase: "spec" as const, megaEnabled: true };
      writeState(tmp, initialState);
      handleSaveArtifact(tmp, "spec", "content");
      const stateAfter = JSON.parse(readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8"));
      expect(stateAfter.phase).toBe("spec");
    });

    it("creates plan directory if missing", () => {
      writeState(tmp, { ...createInitialState(), activeIssue: "002-new", megaEnabled: true });
      const result = handleSaveArtifact(tmp, "brainstorm", "ideas");
      expect(result.error).toBeUndefined();
      expect(existsSync(join(tmp, ".megapowers", "plans", "002-new", "brainstorm.md"))).toBe(true);
    });

    it("returns success message with artifact path", () => {
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
      const result = handleSaveArtifact(tmp, "plan", "content");
      expect(result.message).toBeDefined();
      expect(result.message).toContain("001-test");
      expect(result.message).toContain("plan.md");
    });
  });

  describe("error conditions", () => {
    it("returns error when no active issue", () => {
      writeState(tmp, createInitialState());
      const result = handleSaveArtifact(tmp, "spec", "content");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No active issue");
    });

    it("returns error even for megaEnabled=false when no active issue (megaEnabled check fires first)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: false });
      const result = handleSaveArtifact(tmp, "spec", "content");
      // megaEnabled check fires before activeIssue check
      expect(result.error).toContain("disabled");
    });
  });
});
