import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { writePipelineMeta, readPipelineMeta, clearPipelineMeta } from "../extensions/megapowers/subagent/pipeline-meta.js";

describe("pipeline meta", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "pipeline-meta-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes/reads/clears meta per taskIndex", () => {
    writePipelineMeta(tmp, 1, { pipelineId: "p1", workspacePath: "/ws", createdAt: 123 });

    const m = readPipelineMeta(tmp, 1);
    expect(m?.pipelineId).toBe("p1");

    clearPipelineMeta(tmp, 1);
    expect(readPipelineMeta(tmp, 1)).toBeNull();
  });
});
