---
id: 7
title: Exclude archived issues from idle prompt open-issues summary
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
files_to_create:
  - tests/prompt-inject-archived.test.ts
---

### Task 7: Exclude archived issues from idle prompt open-issues summary [depends: 1]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject-archived.test.ts`
**Step 1 — Write the failing test**
```ts
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
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject-archived.test.ts`
Expected: FAIL — `expect(received).not.toContain(expected) // Expected substring: not "Archived task"`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/prompt-inject.ts
function buildIdlePrompt(_cwd: string, store?: Store): string | null {
  const parts: string[] = [];
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);
  if (store) {
    const issues = store
      .listIssues()
      .filter(i => i.status !== "done" && i.status !== "archived");
    const issueLines = issues.map(i =>
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority ?? "none"})`,
    );
    parts.push(
      issues.length > 0
        ? `## Open Issues\n\n${issueLines.join("\n")}`
        : "## Open Issues\n\nNo open issues. Use `/issue new` to create one.",
    );
  }

  parts.push(`## Available Commands
- \`/issue new\` — create a new issue
- \`/issue list\` — pick an issue to work on
- \`/triage\` — batch and prioritize open issues
- \`/mega on|off\` — enable/disable workflow enforcement`);
  parts.push("See `ROADMAP.md` and `.megapowers/milestones.md` for what's next.");
  return parts.length > 0 ? parts.join("\n\n") : null;
}
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject-archived.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
