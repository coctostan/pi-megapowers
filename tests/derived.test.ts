import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deriveTasks, deriveAcceptanceCriteria } from "../extensions/megapowers/state/derived.js";

describe("derived", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "derived-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writePlan(issue: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), content);
  }

  function writeSpec(issue: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.md"), content);
  }

  function writeDiagnosis(issue: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "diagnosis.md"), content);
  }

  describe("deriveTasks", () => {
    it("parses tasks from plan.md", () => {
      writePlan("001-test", "# Plan\n\n### Task 1: Setup\n\n### Task 2: Build [no-test]\n\n### Task 3: Integrate [depends: 1, 2]\n");
      const tasks = deriveTasks(tmp, "001-test");
      expect(tasks).toHaveLength(3);
      expect(tasks[0].index).toBe(1);
      expect(tasks[1].noTest).toBe(true);
      expect(tasks[2].dependsOn).toEqual([1, 2]);
    });

    it("returns empty array when plan.md missing", () => {
      expect(deriveTasks(tmp, "001-missing")).toEqual([]);
    });

    it("returns empty array when plan.md has no tasks", () => {
      writePlan("001-empty", "# Plan\n\nNo tasks here.\n");
      expect(deriveTasks(tmp, "001-empty")).toEqual([]);
    });
  });

  describe("deriveAcceptanceCriteria", () => {
    it("parses from spec.md for feature workflow", () => {
      writeSpec("001-test", "# Spec\n\n## Acceptance Criteria\n1. User can log in\n2. User sees dashboard\n");
      const criteria = deriveAcceptanceCriteria(tmp, "001-test", "feature");
      expect(criteria).toHaveLength(2);
      expect(criteria[0].text).toBe("User can log in");
    });

    it("parses from diagnosis.md for bugfix workflow", () => {
      writeDiagnosis("001-test", "# Diagnosis\n\n## Fixed When\n1. Error no longer occurs\n2. Tests pass\n");
      const criteria = deriveAcceptanceCriteria(tmp, "001-test", "bugfix");
      expect(criteria).toHaveLength(2);
      expect(criteria[0].text).toBe("Error no longer occurs");
    });

    it("returns empty array when artifact missing", () => {
      expect(deriveAcceptanceCriteria(tmp, "001-missing", "feature")).toEqual([]);
    });

    it("returns empty array for bugfix when diagnosis.md missing", () => {
      expect(deriveAcceptanceCriteria(tmp, "001-missing", "bugfix")).toEqual([]);
    });
  });
});
