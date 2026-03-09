import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-errors-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store.archiveIssue errors (AC23-AC24)", () => {
  it("returns clear errors for missing issues and already archived issues", () => {
    const missing = store.archiveIssue("999-missing-issue");
    expect(missing).toEqual({ ok: false, error: "Issue not found: 999-missing-issue" });

    const created = store.createIssue("Archive me", "feature", "desc");
    const first = store.archiveIssue(created.slug);
    expect(first.ok).toBe(true);

    const second = store.archiveIssue(created.slug);
    expect(second).toEqual({ ok: false, error: `Issue already archived: ${created.slug}` });
  });
});
