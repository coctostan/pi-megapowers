import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-op-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store.archiveIssue success path (AC14-AC22)", () => {
  it("moves the file into archive, rewrites status, writes archived timestamp, and preserves identity fields", () => {
    const openIssue = store.createIssue("Open item", "feature", "desc");
    const inProgressIssue = store.createIssue("In progress item", "feature", "desc");
    store.updateIssueStatus(inProgressIssue.slug, "in-progress");
    const doneIssue = store.createIssue("Done item", "feature", "desc");
    store.updateIssueStatus(doneIssue.slug, "done");

    const openResult = store.archiveIssue(openIssue.slug);
    const inProgressResult = store.archiveIssue(inProgressIssue.slug);
    const doneResult = store.archiveIssue(doneIssue.slug);

    expect(openResult.ok).toBe(true);
    expect(inProgressResult.ok).toBe(true);
    expect(doneResult.ok).toBe(true);

    const archivedPath = join(tmp, ".megapowers", "issues", "archive", `${openIssue.slug}.md`);
    expect(existsSync(archivedPath)).toBe(true);
    expect(existsSync(join(tmp, ".megapowers", "issues", `${openIssue.slug}.md`))).toBe(false);

    const archivedContent = readFileSync(archivedPath, "utf-8");
    expect(archivedContent).toContain("status: archived");
    expect(archivedContent).toMatch(/archived:\s*\d{4}-\d{2}-\d{2}T/);
    expect(archivedContent).toContain(`id: ${openIssue.id}`);
    expect(archivedContent).toContain(`# ${openIssue.title}`);

    const archivedIssues = store.listArchivedIssues();
    expect(archivedIssues.map(i => i.slug)).toEqual([
      doneIssue.slug,
      inProgressIssue.slug,
      openIssue.slug,
    ].sort());
  });
});

describe("store.createIssue ID uniqueness after archiving (review fix)", () => {
  it("does not reuse IDs of archived issues when creating new issues", () => {
    const i1 = store.createIssue("First", "feature", "desc");
    const i2 = store.createIssue("Second", "feature", "desc");
    const i3 = store.createIssue("Third", "feature", "desc");
    expect(i3.id).toBe(3);

    store.archiveIssue(i3.slug);

    const i4 = store.createIssue("Fourth", "feature", "desc");
    expect(i4.id).not.toBe(3); // must not reuse archived ID
    expect(i4.id).toBe(4);

    // Both active and archived IDs must be unique across the system
    const active = store.listIssues().map(i => i.id);
    const archived = store.listArchivedIssues().map(i => i.id);
    const allIds = [...active, ...archived];
    expect(allIds).toEqual([...new Set(allIds)]); // no duplicates
  });
});
