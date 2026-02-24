import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  writeSubagentStatus,
  readSubagentStatus,
  updateSubagentStatus,
  subagentDir,
  type SubagentState,
  type SubagentStatus,
} from "../extensions/megapowers/subagent-status.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("subagentDir", () => {
  it("returns .megapowers/subagents/<id>/ path", () => {
    expect(subagentDir("/project", "abc123")).toBe("/project/.megapowers/subagents/abc123");
  });
});

describe("writeSubagentStatus / readSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-status-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes and reads status.json", () => {
    const status: SubagentStatus = {
      id: "sa-001",
      state: "running",
      turnsUsed: 3,
      startedAt: 1000,
    };
    writeSubagentStatus(tmp, "sa-001", status);
    const read = readSubagentStatus(tmp, "sa-001");
    expect(read).toEqual(status);
  });

  it("overwrites status entirely", () => {
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
      phase: "implement",
    });
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "completed",
      turnsUsed: 5,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/foo.ts"],
      testsPassed: true,
    });
    const read = readSubagentStatus(tmp, "sa-002");
    expect(read!.state).toBe("completed");
    expect(read!.turnsUsed).toBe(5);
    expect(read!.filesChanged).toEqual(["src/foo.ts"]);
    expect(read!.phase).toBeUndefined();
  });

  it("returns null when status file does not exist", () => {
    expect(readSubagentStatus(tmp, "nonexistent")).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    const dir = join(tmp, ".megapowers", "subagents", "corrupt");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "status.json"), "not json");
    expect(readSubagentStatus(tmp, "corrupt")).toBeNull();
  });

  it("includes error field for failed state", () => {
    const status: SubagentStatus = {
      id: "sa-003",
      state: "failed",
      turnsUsed: 2,
      startedAt: 1000,
      completedAt: 1500,
      error: "Process exited with code 1",
    };
    writeSubagentStatus(tmp, "sa-003", status);
    const read = readSubagentStatus(tmp, "sa-003");
    expect(read!.state).toBe("failed");
    expect(read!.error).toBe("Process exited with code 1");
  });

  it("includes diff field for completed state", () => {
    const status: SubagentStatus = {
      id: "sa-004",
      state: "completed",
      turnsUsed: 4,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/a.ts", "tests/a.test.ts"],
      diff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new",
      testsPassed: true,
    };
    writeSubagentStatus(tmp, "sa-004", status);
    const read = readSubagentStatus(tmp, "sa-004");
    expect(read!.diff).toContain("src/a.ts");
  });

  it("includes phase field for running subagent", () => {
    const status: SubagentStatus = {
      id: "sa-006",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
      phase: "implement",
    };
    writeSubagentStatus(tmp, "sa-006", status);
    const read = readSubagentStatus(tmp, "sa-006");
    expect(read!.phase).toBe("implement");
  });

  it("includes detectedErrors field", () => {
    const status: SubagentStatus = {
      id: "sa-005",
      state: "failed",
      turnsUsed: 6,
      startedAt: 1000,
      completedAt: 3000,
      detectedErrors: ["TypeError: x is not a function"],
    };
    writeSubagentStatus(tmp, "sa-005", status);
    const read = readSubagentStatus(tmp, "sa-005");
    expect(read!.detectedErrors).toEqual(["TypeError: x is not a function"]);
  });

  it("includes diffPath for large diffs", () => {
    const status: SubagentStatus = {
      id: "sa-007",
      state: "completed",
      turnsUsed: 3,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/big.ts"],
      diffPath: ".megapowers/subagents/sa-007/diff.patch",
      testsPassed: true,
    };
    writeSubagentStatus(tmp, "sa-007", status);
    const read = readSubagentStatus(tmp, "sa-007");
    expect(read!.diffPath).toBe(".megapowers/subagents/sa-007/diff.patch");
  });
});

describe("updateSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-update-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("merges partial update with existing status", () => {
    writeSubagentStatus(tmp, "sa-merge", {
      id: "sa-merge",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
      phase: "implement",
    });
    updateSubagentStatus(tmp, "sa-merge", { turnsUsed: 5 });
    const read = readSubagentStatus(tmp, "sa-merge");
    expect(read!.turnsUsed).toBe(5);
    expect(read!.phase).toBe("implement");
    expect(read!.state).toBe("running");
  });

  it("refuses to overwrite terminal state", () => {
    writeSubagentStatus(tmp, "sa-terminal", {
      id: "sa-terminal",
      state: "completed",
      turnsUsed: 5,
      startedAt: 1000,
      completedAt: 2000,
    });
    const updated = updateSubagentStatus(tmp, "sa-terminal", { state: "running", turnsUsed: 6 });
    expect(updated).toBe(false);
    const read = readSubagentStatus(tmp, "sa-terminal");
    expect(read!.state).toBe("completed");
    expect(read!.turnsUsed).toBe(5);
  });

  it("allows transition TO terminal state", () => {
    writeSubagentStatus(tmp, "sa-finish", {
      id: "sa-finish",
      state: "running",
      turnsUsed: 3,
      startedAt: 1000,
      phase: "implement",
    });
    const updated = updateSubagentStatus(tmp, "sa-finish", {
      state: "completed",
      completedAt: 2000,
      turnsUsed: 5,
    });
    expect(updated).toBe(true);
    const read = readSubagentStatus(tmp, "sa-finish");
    expect(read!.state).toBe("completed");
    expect(read!.phase).toBe("implement");
    expect(read!.turnsUsed).toBe(5);
  });

  it("returns false when no existing status to merge with", () => {
    const updated = updateSubagentStatus(tmp, "sa-missing", { turnsUsed: 1 });
    expect(updated).toBe(false);
  });
});
