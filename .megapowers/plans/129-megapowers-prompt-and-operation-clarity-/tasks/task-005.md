---
id: 5
title: Compact no-active-issue prompt
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/prompt-inject.test.ts`

Covers AC28–AC32. Replaces the protocol-pushing `buildIdlePrompt` (lines 29–57) with a compact no-active-issue form that has the `## Megapowers` heading, an explicit allowed-actions list (`/issue list`, `/issue new`, `/triage`), the two universal rules, and the same per-issue `- #NNN ... (milestone: ..., priority: ...)` list — without the full `## Megapowers Protocol` block.

**Step 1 — Write the failing test**

Append to `tests/prompt-inject.test.ts`:

```ts
describe("buildInjectedPrompt — compact no-active-issue prompt", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "compact-idle-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("contains `## Megapowers` and `No active issue.` line (AC28)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("## Megapowers");
    expect(r).toContain("No active issue.");
  });

  it("lists /issue list, /issue new, /triage (AC29)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("/issue list");
    expect(r).toContain("/issue new");
    expect(r).toContain("/triage");
  });

  it("includes universal rules (AC30)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("Do not edit .megapowers/state.json.");
    expect(r.toLowerCase()).toContain("follow its message");
  });

  it("includes compact open-issues list filtered to non-done/archived (AC31)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);
    store.createIssue("Auth refactor", "feature", "Refactor auth module");
    store.createIssue("Done task", "bugfix", "Already done");
    store.updateIssueStatus("002-done-task", "done");

    const r = buildInjectedPrompt(tmp, store)!;
    expect(r).toContain("#001");
    expect(r).toContain("Auth refactor");
    expect(r).toMatch(/milestone:.*priority:/);
    expect(r).not.toContain("Done task");
  });

  it("does NOT include the full `## Megapowers Protocol` block (AC32)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).not.toContain("## Megapowers Protocol");
  });
});
```

The pre-existing idle test that asserts `"Megapowers Protocol"` and `"Artifact Persistence"` is present (around line 353 — `"includes protocol section with tool names (AC3)"`) must be updated:

```ts
  it("includes compact megapowers header in idle prompt", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("## Megapowers");
    expect(result).not.toContain("## Megapowers Protocol");
  });
```

The existing test `"includes roadmap and milestones reference (AC6)"` references content from the old idle prompt. Replace with a parallel check that the compact prompt is still informative:

```ts
  it("idle prompt is non-empty and mentions issue selection actions", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp)!;
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("/issue list");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts`
Expected: FAIL — `expect(received).not.toContain(expected) — Expected substring: "## Megapowers Protocol"` (current `buildIdlePrompt` always pushes the full protocol).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, replace the existing `buildIdlePrompt` (lines 29–57) with:

```ts
function buildIdlePrompt(_cwd: string, store?: Store): string {
  const lines: string[] = [
    "## Megapowers",
    "",
    "No active issue.",
    "",
    "Allowed now:",
    "- `/issue list` to pick an issue.",
    "- `/issue new` to create an issue.",
    "- `/triage` to batch/prioritize open issues.",
    "",
    "Rules:",
    "- Do not edit .megapowers/state.json.",
    "- If a Megapowers tool errors, follow its message and retry rather than working around it.",
    "",
    "Commands: `/issue list`, `/issue new`, `/triage`, `/mega on|off`.",
  ];

  if (store) {
    const issues = store.listIssues().filter(i => i.status !== "done" && i.status !== "archived");
    lines.push("");
    if (issues.length > 0) {
      lines.push("## Open Issues");
      lines.push("");
      for (const i of issues) {
        lines.push(
          `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority ?? "none"})`,
        );
      }
    } else {
      lines.push("## Open Issues");
      lines.push("");
      lines.push("No open issues. Use `/issue new` to create one.");
    }
  }

  return lines.join("\n");
}
```

Note: AC31 says the open-issues *list* uses the existing format; AC26/AC27 only forbid those headings in the *active-issue* prompt. The idle path is exempt — the open-issues list is one of the cases where this content is helpful.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
