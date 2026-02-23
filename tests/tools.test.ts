import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../extensions/megapowers/store.js";
import { createBatchHandler } from "../extensions/megapowers/tools.js";
import { readState } from "../extensions/megapowers/state-io.js";

let tmp: string;
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "megapowers-test-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("createBatchHandler", () => {
  it("creates a batch issue with title, type, description, and source IDs (AC 1, 3)", () => {
    store.createIssue("Bug A", "bugfix", "First bug");
    store.createIssue("Bug B", "bugfix", "Second bug");

    const result = createBatchHandler(store, {
      title: "Parser fixes",
      type: "bugfix",
      sourceIds: [1, 2],
      description: "Fix both parser bugs",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.slug).toContain("parser-fixes");
      expect(result.id).toBeGreaterThan(2);
    }
  });

  it("returns slug and id on success (AC 4)", () => {
    store.createIssue("Bug A", "bugfix", "desc");
    const result = createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1],
      description: "desc",
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(typeof result.slug).toBe("string");
      expect(typeof result.id).toBe("number");
    }
  });

  it("returns error when a sourceId does not exist (AC 5)", () => {
    store.createIssue("Bug A", "bugfix", "desc");
    const result = createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1, 99],
      description: "desc",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("99");
    }
  });

  it("returns error when a sourceId references a done issue (AC 5)", () => {
    const issue = store.createIssue("Bug A", "bugfix", "desc");
    store.updateIssueStatus(issue.slug, "done");
    const result = createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1],
      description: "desc",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("1");
    }
  });

  it("does not change workflow state (AC 6)", () => {
    store.createIssue("Bug A", "bugfix", "desc");
    const stateBefore = readState(tmp);
    createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1],
      description: "desc",
    });
    const stateAfter = readState(tmp);
    expect(stateAfter.activeIssue).toBe(stateBefore.activeIssue);
    expect(stateAfter.phase).toBe(stateBefore.phase);
    expect(stateAfter.workflow).toBe(stateBefore.workflow);
  });
});
