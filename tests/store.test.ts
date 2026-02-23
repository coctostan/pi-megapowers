import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store, type Issue } from "../extensions/megapowers/store.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "megapowers-test-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("state persistence", () => {
  it("saves and loads state round-trip", () => {
    const state = createInitialState();
    state.activeIssue = "001-test";
    state.workflow = "feature";
    state.phase = "brainstorm";

    store.saveState(state);
    const loaded = store.loadState();

    expect(loaded.activeIssue).toBe("001-test");
    expect(loaded.workflow).toBe("feature");
    expect(loaded.phase).toBe("brainstorm");
  });

  it("returns initial state when no state file exists", () => {
    const state = store.loadState();
    expect(state.activeIssue).toBeNull();
    expect(state.version).toBe(1);
  });

  it("migrates legacy state missing new fields", () => {
    // Simulate a state file from before the feature-mode changes
    const legacyState = {
      version: 1,
      activeIssue: "001-test",
      workflow: "feature",
      phase: "brainstorm",
      phaseHistory: [],
      reviewApproved: false,
      planTasks: [],
      jjChangeId: null,
      // Missing: acceptanceCriteria, currentTaskIndex
    };
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify(legacyState));

    const loaded = store.loadState();
    expect(loaded.activeIssue).toBe("001-test");
    expect(loaded.completedTasks).toEqual([]);
    expect(loaded.currentTaskIndex).toBe(0);
    expect(loaded.megaEnabled).toBe(true);
  });

  it("persists tddTaskState through save/load", () => {
    const state = createInitialState();
    state.activeIssue = "001-test";
    state.tddTaskState = { taskIndex: 1, state: "test-written", skipped: false };

    store.saveState(state);
    const loaded = store.loadState();

    expect(loaded.tddTaskState).toEqual({ taskIndex: 1, state: "test-written", skipped: false });
  });

  it("defaults tddTaskState to null for legacy state", () => {
    // Write a legacy state file missing the tddTaskState field
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify({
      version: 1,
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      phaseHistory: [],
      reviewApproved: false,
      planTasks: [],
      jjChangeId: null,
      acceptanceCriteria: [],
      currentTaskIndex: 0,
      // No tddTaskState field - simulating legacy state
    }));

    const loaded = store.loadState();
    expect(loaded.tddTaskState).toBeNull();
  });

  it("persists taskJJChanges through save/load", () => {
    const state = createInitialState();
    state.activeIssue = "001-test";
    state.taskJJChanges = { 1: "abc123", 2: "def456" };

    store.saveState(state);
    const loaded = store.loadState();

    expect(loaded.taskJJChanges).toEqual({ 1: "abc123", 2: "def456" });
  });

  it("defaults taskJJChanges to empty object for legacy state", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify({
      version: 1,
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      phaseHistory: [],
      reviewApproved: false,
      planTasks: [],
      jjChangeId: null,
      acceptanceCriteria: [],
      currentTaskIndex: 0,
      tddTaskState: null,
      // No taskJJChanges — simulating legacy state
    }));

    const loaded = store.loadState();
    expect(loaded.taskJJChanges).toEqual({});
  });

  it("migrates legacy planTasks missing the noTest field", () => {
    // Simulate a state file from before noTest was added to PlanTask
    const legacyState = {
      version: 1,
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      phaseHistory: [],
      reviewApproved: false,
      planTasks: [
        { index: 1, description: "Set up schema", completed: false },
        { index: 2, description: "Write tests", completed: true },
      ],
      currentTaskIndex: 0,
      acceptanceCriteria: [],
      jjChangeId: null,
    };
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify(legacyState));

    const loaded = store.loadState();
    expect(loaded.planTasks).toHaveLength(2);
    expect(loaded.planTasks![0].noTest).toBe(false);
    expect(loaded.planTasks![1].noTest).toBe(false);
  });
});

describe("issues", () => {
  it("creates an issue with auto-incrementing ID", () => {
    const issue = store.createIssue("Auth refactor", "feature", "Refactor auth to use JWT");
    expect(issue.id).toBe(1);
    expect(issue.slug).toBe("001-auth-refactor");
    expect(issue.title).toBe("Auth refactor");
    expect(issue.type).toBe("feature");
    expect(issue.status).toBe("open");
  });

  it("lists all issues", () => {
    store.createIssue("First", "feature", "desc");
    store.createIssue("Second", "bugfix", "desc");
    const issues = store.listIssues();
    expect(issues).toHaveLength(2);
    expect(issues[0].slug).toBe("001-first");
    expect(issues[1].slug).toBe("002-second");
  });

  it("gets an issue by slug", () => {
    store.createIssue("Auth refactor", "feature", "desc");
    const issue = store.getIssue("001-auth-refactor");
    expect(issue).not.toBeNull();
    expect(issue!.title).toBe("Auth refactor");
  });

  it("returns null for unknown slug", () => {
    expect(store.getIssue("999-nope")).toBeNull();
  });

  it("updates issue status", () => {
    store.createIssue("Test", "feature", "desc");
    store.updateIssueStatus("001-test", "in-progress");
    const issue = store.getIssue("001-test");
    expect(issue!.status).toBe("in-progress");
  });

  it("generates correct ID after non-contiguous deletions", () => {
    store.createIssue("First", "feature", "desc");
    store.createIssue("Second", "feature", "desc");
    // Simulate deletion of issue 001
    const { rmSync: rm } = require("node:fs");
    const { join: pjoin } = require("node:path");
    rm(pjoin(tmp, ".megapowers", "issues", "001-first.md"));

    const third = store.createIssue("Third", "feature", "desc");
    expect(third.id).toBe(3);
    expect(third.slug).toBe("003-third");
  });
});

describe("sources field", () => {
  it("parses sources from issue frontmatter into number array", () => {
    // Manually write an issue file with sources in frontmatter
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers", "issues"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "issues", "019-batch-parser-fixes.md"), `---
id: 19
type: bugfix
status: open
created: 2026-02-23T00:00:00.000Z
sources: [6, 13, 17]
---

# Batch parser fixes

Consolidation of parser-related bugs.
`);
    const issue = store.getIssue("019-batch-parser-fixes");
    expect(issue).not.toBeNull();
    expect(issue!.sources).toEqual([6, 13, 17]);
  });

  it("returns empty array for issues without sources field", () => {
    const issue = store.createIssue("Regular issue", "feature", "No sources");
    expect(issue.sources).toEqual([]);
  });

  it("returns empty array for issues with empty sources", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers", "issues"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "issues", "019-empty-sources.md"), `---
id: 19
type: bugfix
status: open
created: 2026-02-23T00:00:00.000Z
sources: []
---

# Empty sources test
`);
    const issue = store.getIssue("019-empty-sources");
    expect(issue!.sources).toEqual([]);
  });

  it("includes sources in listIssues output", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers", "issues"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "issues", "001-batch.md"), `---
id: 1
type: bugfix
status: open
created: 2026-02-23T00:00:00.000Z
sources: [5, 10]
---

# Batch fix
`);
    const issues = store.listIssues();
    expect(issues[0].sources).toEqual([5, 10]);
  });
});

it("creates an issue with sources in frontmatter", () => {
  const issue = store.createIssue("Batch fix", "bugfix", "Combined fix", [6, 13, 17]);
  expect(issue.sources).toEqual([6, 13, 17]);

  // Verify persisted to file
  const reloaded = store.getIssue(issue.slug);
  expect(reloaded!.sources).toEqual([6, 13, 17]);
});

it("creates an issue without sources when parameter omitted", () => {
  const issue = store.createIssue("Normal", "feature", "desc");
  expect(issue.sources).toEqual([]);

  const reloaded = store.getIssue(issue.slug);
  expect(reloaded!.sources).toEqual([]);
});

describe("getSourceIssues", () => {
  it("returns Issue objects for each source ID", () => {
    store.createIssue("Bug A", "bugfix", "desc A");  // id 1
    store.createIssue("Bug B", "bugfix", "desc B");  // id 2
    store.createIssue("Bug C", "bugfix", "desc C");  // id 3

    // Create batch referencing 1 and 3
    const batch = store.createIssue("Batch fix", "bugfix", "combined", [1, 3]);
    const sources = store.getSourceIssues(batch.slug);

    expect(sources).toHaveLength(2);
    expect(sources[0].id).toBe(1);
    expect(sources[0].title).toBe("Bug A");
    expect(sources[1].id).toBe(3);
    expect(sources[1].title).toBe("Bug C");
  });

  it("returns empty array for non-batch issue", () => {
    const issue = store.createIssue("Normal", "feature", "desc");
    expect(store.getSourceIssues(issue.slug)).toEqual([]);
  });

  it("returns empty array for unknown slug", () => {
    expect(store.getSourceIssues("999-nonexistent")).toEqual([]);
  });

  it("skips source IDs that don't match any existing issue", () => {
    store.createIssue("Bug A", "bugfix", "desc A");  // id 1
    const batch = store.createIssue("Batch fix", "bugfix", "combined", [1, 99]);
    const sources = store.getSourceIssues(batch.slug);
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe(1);
  });
});

describe("getBatchForIssue", () => {
  it("returns batch slug when issue is a source in an open batch", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = store.createIssue("Batch", "bugfix", "combined", [1]);
    const result = store.getBatchForIssue(1);
    expect(result).toBe(batch.slug);
  });

  it("returns batch slug when issue is a source in an in-progress batch", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = store.createIssue("Batch", "bugfix", "combined", [1]);
    store.updateIssueStatus(batch.slug, "in-progress");
    expect(store.getBatchForIssue(1)).toBe(batch.slug);
  });

  it("returns null when issue is not in any batch", () => {
    store.createIssue("Standalone", "bugfix", "desc");  // id 1
    expect(store.getBatchForIssue(1)).toBeNull();
  });

  it("returns null when only batch containing the issue is done", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = store.createIssue("Batch", "bugfix", "combined", [1]);
    store.updateIssueStatus(batch.slug, "done");
    expect(store.getBatchForIssue(1)).toBeNull();
  });

  it("returns first matching batch when issue is in multiple batches", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch1 = store.createIssue("Batch 1", "bugfix", "combined", [1]);
    const batch2 = store.createIssue("Batch 2", "bugfix", "combined", [1]);
    // First by file sort order (002 before 003)
    expect(store.getBatchForIssue(1)).toBe(batch1.slug);
  });
});

describe("plan files", () => {
  it("writes and reads a plan file", () => {
    store.createIssue("Test", "feature", "desc");
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "# Spec\nDo the thing");

    const content = store.readPlanFile("001-test", "spec.md");
    expect(content).toBe("# Spec\nDo the thing");
  });

  it("returns null for missing plan file", () => {
    expect(store.readPlanFile("001-nope", "spec.md")).toBeNull();
  });

  it("checks plan file existence", () => {
    store.createIssue("Test", "feature", "desc");
    store.ensurePlanDir("001-test");
    expect(store.planFileExists("001-test", "spec.md")).toBe(false);
    store.writePlanFile("001-test", "spec.md", "content");
    expect(store.planFileExists("001-test", "spec.md")).toBe(true);
  });
});

describe("learnings", () => {
  it("appends and retrieves learnings", () => {
    store.appendLearning("Auth module needs token mock");
    store.appendLearning("Use bun test not vitest");

    const learnings = store.getLearnings();
    expect(learnings).toContain("Auth module needs token mock");
    expect(learnings).toContain("Use bun test not vitest");
  });

  it("returns empty string when no learnings", () => {
    expect(store.getLearnings()).toBe("");
  });
});

describe("appendLearnings — attributed entries", () => {
  it("appends a dated block attributed to the issue slug", () => {
    store.appendLearnings("001-auth", ["Token service needs DI mocking", "Use fake clock for timer tests"]);
    const content = store.getLearnings();
    expect(content).toMatch(/## \d{4}-\d{2}-\d{2} — 001-auth/);
    expect(content).toContain("Token service needs DI mocking");
    expect(content).toContain("Use fake clock for timer tests");
  });

  it("appends multiple blocks independently", () => {
    store.appendLearnings("001-auth", ["First learning"]);
    store.appendLearnings("002-retry", ["Second learning"]);
    const content = store.getLearnings();
    expect(content).toContain("001-auth");
    expect(content).toContain("002-retry");
    expect(content).toContain("First learning");
    expect(content).toContain("Second learning");
  });

  it("writes nothing when entries array is empty", () => {
    store.appendLearnings("001-auth", []);
    expect(store.getLearnings()).toBe("");
  });
});

describe("readRoadmap", () => {
  it("returns empty string when ROADMAP.md does not exist", () => {
    expect(store.readRoadmap()).toBe("");
  });

  it("returns roadmap content when ROADMAP.md exists in project root", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(join(tmp, "ROADMAP.md"), "# Roadmap\n\n- Phase 1: Auth\n- Phase 2: API\n");
    expect(store.readRoadmap()).toContain("Phase 1: Auth");
  });
});

describe("writeFeatureDoc", () => {
  it("writes doc to .megapowers/docs/{slug}.md", () => {
    store.writeFeatureDoc("001-auth", "# Feature: Auth\n\nBuilt JWT auth.");
    const { readFileSync, existsSync } = require("node:fs");
    const docPath = join(tmp, ".megapowers", "docs", "001-auth.md");
    expect(existsSync(docPath)).toBe(true);
    expect(readFileSync(docPath, "utf-8")).toContain("Built JWT auth.");
  });

  it("creates the docs directory if it does not exist", () => {
    expect(() => store.writeFeatureDoc("001-auth", "content")).not.toThrow();
  });
});

describe("appendChangelog", () => {
  it("creates CHANGELOG.md and appends an entry", () => {
    store.appendChangelog("## v1.1.0\n\n- Added JWT auth");
    const { readFileSync } = require("node:fs");
    const changelogPath = join(tmp, ".megapowers", "CHANGELOG.md");
    const content = readFileSync(changelogPath, "utf-8");
    expect(content).toContain("Added JWT auth");
  });

  it("appends to existing CHANGELOG.md without overwriting", () => {
    store.appendChangelog("Entry 1");
    store.appendChangelog("Entry 2");
    const { readFileSync } = require("node:fs");
    const content = readFileSync(join(tmp, ".megapowers", "CHANGELOG.md"), "utf-8");
    expect(content).toContain("Entry 1");
    expect(content).toContain("Entry 2");
  });
});
