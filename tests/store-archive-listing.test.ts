import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-listing-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store archive-aware listing (AC1-AC3)", () => {
  it("parses archived status and separates active issues from archived issues", () => {
    const active = store.createIssue("Active item", "feature", "active desc", undefined, "M2", 2);

    const archiveDir = join(tmp, ".megapowers", "issues", "archive");
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(
      join(archiveDir, "099-archived-item.md"),
      `---\nid: 99\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\n---\n# Archived item\narchived desc\n`,
    );

    const activeIssues = store.listIssues();
    const archivedIssues = store.listArchivedIssues();

    expect(activeIssues.map(i => i.slug)).toEqual([active.slug]);
    expect(activeIssues.some(i => i.status === "archived")).toBe(false);
    expect(archivedIssues).toHaveLength(1);
    expect(archivedIssues[0].slug).toBe("099-archived-item");
    expect(archivedIssues[0].status).toBe("archived");
  });
});
