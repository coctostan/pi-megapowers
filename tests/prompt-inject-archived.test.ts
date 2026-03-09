import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "prompt-inject-archived-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("buildInjectedPrompt archived issue filtering (AC29)", () => {
  it("does not include archived issues in the open issue list", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);
    store.createIssue("Open task", "feature", "Still open", undefined, "M2", 2);

    // Write an archived-status issue directly into the active directory
    // so this test exercises the filter itself rather than archive dir separation.
    const issuesDir = join(tmp, ".megapowers", "issues");
    writeFileSync(
      join(issuesDir, "002-archived-task.md"),
      `---\nid: 2\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\n---\n# Archived task\nNo longer active\n`,
    );

    const prompt = buildInjectedPrompt(tmp, store)!;
    expect(prompt).toContain("Open task");
    expect(prompt).not.toContain("Archived task");
  });
});
