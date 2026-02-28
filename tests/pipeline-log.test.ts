import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeLogEntry, readPipelineLog } from "../extensions/megapowers/subagent/pipeline-log.js";

describe("pipeline log", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "pipeline-log-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("writes JSONL entries under .megapowers/subagents/{id}/log.jsonl", () => {
    writeLogEntry(tmp, "pipe-1", { step: "implement", status: "completed", durationMs: 10, summary: "ok" });
    const p = join(tmp, ".megapowers", "subagents", "pipe-1", "log.jsonl");
    expect(existsSync(p)).toBe(true);
    const line = readFileSync(p, "utf-8").trim();
    const parsed = JSON.parse(line);
    expect(parsed.step).toBe("implement");
  });

  it("reads entries back in order", () => {
    writeLogEntry(tmp, "pipe-1", { step: "implement", status: "completed", durationMs: 1, summary: "a" });
    writeLogEntry(tmp, "pipe-1", { step: "verify", status: "failed", durationMs: 1, summary: "b", error: "boom" });
    const entries = readPipelineLog(tmp, "pipe-1");
    expect(entries).toHaveLength(2);
    expect(entries[1].error).toBe("boom");
  });
});
