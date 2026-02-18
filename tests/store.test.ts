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
