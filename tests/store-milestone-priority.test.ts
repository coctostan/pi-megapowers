import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-ms-pr-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("createIssue milestone and priority frontmatter (AC12-AC15)", () => {
  it("includes milestone: and priority: in frontmatter when provided", () => {
    const issue = store.createIssue("With both", "feature", "desc", undefined, "M2", 2);
    const content = readFileSync(join(tmp, ".megapowers", "issues", `${issue.slug}.md`), "utf-8");
    expect(content).toContain("milestone: M2");
    expect(content).toContain("priority: 2");
  });

  it("omits milestone: and priority: from frontmatter when not provided", () => {
    const issue = store.createIssue("Without extras", "feature", "desc");
    const content = readFileSync(join(tmp, ".megapowers", "issues", `${issue.slug}.md`), "utf-8");
    expect(content).not.toContain("milestone:");
    expect(content).not.toContain("priority:");
  });

  it("round-trips milestone and priority through getIssue", () => {
    const created = store.createIssue("Roundtrip", "feature", "desc", undefined, "M3", 5);
    const fetched = store.getIssue(created.slug);
    expect(fetched!.milestone).toBe("M3");
    expect(fetched!.priority).toBe(5);
  });

  it("returns undefined for milestone and priority when not provided", () => {
    const created = store.createIssue("Bare", "feature", "desc");
    const fetched = store.getIssue(created.slug);
    expect(fetched!.milestone).toBeUndefined();
    expect(fetched!.priority).toBeUndefined();
  });
});
