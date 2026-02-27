# Plan: Agent Context & Awareness (#050)

## AC ↔ Task Mapping

| AC | Task(s) | Description |
|----|---------|-------------|
| 1  | 2       | buildInjectedPrompt returns content when mega enabled + no active issue |
| 2  | 2       | buildInjectedPrompt returns null when mega disabled |
| 3  | 3       | Idle prompt includes protocol section |
| 4  | 4       | Idle prompt includes open issues with id, title, milestone, priority |
| 5  | 5       | Idle prompt includes slash command hints |
| 6  | 6       | Idle prompt includes roadmap/milestones reference |
| 7  | 7       | Dashboard idle mode includes /triage and /mega hints |
| 8  | 8       | Dashboard idle mode includes roadmap reference |
| 9  | 9       | Dashboard active issue unchanged |
| 10 | 10      | Protocol template lists phase_back signal |
| 11 | 10      | Protocol template lists learnings artifact phase |
| 12 | 11      | review-plan.md section numbering fixed |
| 13 | 11      | review-plan.md references phase_back |
| 14 | 12      | implement-task.md Execution Mode tightened |
| 15 | 13      | verify.md references phase_back |
| 16 | 14      | code-review.md references phase_back in needs-fixes and needs-rework |

---

### Task 1: Add milestone and priority fields to Issue type and parser

**Covers:** Prerequisite for AC4

**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Test: `tests/store.test.ts`

**Step 1 — Write the failing test**

Add to the `"issues"` describe block in `tests/store.test.ts`:

```typescript
  it("parses milestone and priority from frontmatter", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    const { join } = require("node:path");

    // Write an issue file with milestone and priority in frontmatter
    const issuesDir = join(tmp, ".megapowers", "issues");
    mkdirSync(issuesDir, { recursive: true });
    writeFileSync(join(issuesDir, "001-test-issue.md"), `---
id: 1
type: feature
status: open
created: 2026-01-01T00:00:00.000Z
milestone: M2
priority: 2
---

# Test issue

Description here
`);

    const issues = store.listIssues();
    expect(issues.length).toBe(1);
    expect(issues[0].milestone).toBe("M2");
    expect(issues[0].priority).toBe(2);
  });

  it("defaults milestone to empty string and priority to 0 when not in frontmatter", () => {
    const issue = store.createIssue("No metadata", "feature", "Bare issue");
    const fetched = store.getIssue(issue.slug);
    expect(fetched!.milestone).toBe("");
    expect(fetched!.priority).toBe(0);
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/store.test.ts -t "parses milestone and priority"`

Expected: FAIL — Property `milestone` does not exist on type `Issue`. TypeScript compilation error or runtime `undefined` assertion failure.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/store.ts`:

1. Add fields to the `Issue` interface (after `sources: number[];`):

```typescript
  milestone: string;
  priority: number;
```

2. In `parseIssueFrontmatter`, add to the return object (after `sources,`):

```typescript
    milestone: data.milestone ?? undefined,
    priority: data.priority ? parseInt(data.priority) : undefined,
```

3. In `listIssues()`, add to the mapped return object (after `sources: parsed.sources ?? [],`):

```typescript
            milestone: parsed.milestone ?? "",
            priority: parsed.priority ?? 0,
```

4. In `getIssue()`, add to the return object (after `sources: parsed.sources ?? [],`):

```typescript
        milestone: parsed.milestone ?? "",
        priority: parsed.priority ?? 0,
```

5. In `createIssue()`, add to the `issue` object (after `sources: sources ?? [],`):

```typescript
        milestone: "",
        priority: 0,
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/store.test.ts -t "parses milestone and priority"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 2: buildInjectedPrompt returns content in idle mode (AC1, AC2)

**Covers AC 1, 2**

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add a new describe block at the end of `tests/prompt-inject.test.ts`:

```typescript
describe("buildInjectedPrompt — idle mode", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-idle-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns non-null when megaEnabled is true and no active issue (AC1)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns null when megaEnabled is false with no active issue (AC2)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  it("returns null when megaEnabled is false with active issue (AC2)", () => {
    writeState(tmp, {
      ...createInitialState(),
      megaEnabled: false,
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "returns non-null when megaEnabled is true and no active issue"`

Expected: FAIL — `expected null not to be null`. The current code at line 28 returns null when `!state.activeIssue`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`:

Replace line 28:
```typescript
  if (!state.activeIssue || !state.phase) return null;
```

With:
```typescript
  if (!state.activeIssue || !state.phase) {
    return buildIdlePrompt(cwd, store);
  }
```

Add a new function before `buildInjectedPrompt`:

```typescript
function buildIdlePrompt(_cwd: string, _store?: Store): string | null {
  return "## Megapowers — Idle Mode\n\nNo active issue. Use the commands below to get started.";
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "idle mode"`

Expected: PASS — all three idle mode tests pass (AC1 returns non-null, both AC2 tests return null since megaEnabled is false and the existing line 27 check handles it).

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing. The existing test "returns null when no active issue" (line 29-32) will now FAIL because idle mode returns content. Update that test:

Replace:
```typescript
  it("returns null when no active issue", () => {
    writeState(tmp, createInitialState());
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });
```

With:
```typescript
  it("returns non-null idle content when no active issue and mega enabled", () => {
    writeState(tmp, createInitialState());
    const result = buildInjectedPrompt(tmp);
    // Default createInitialState has megaEnabled: true
    expect(result).not.toBeNull();
  });
```

Run: `bun test`

Expected: all passing

---

### Task 3: Idle prompt includes protocol section [depends: 2]

**Covers AC 3**

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — idle mode"` describe block in `tests/prompt-inject.test.ts`:

```typescript
  it("includes protocol section with tool descriptions (AC3)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_signal");
    expect(result).toContain("megapowers_save_artifact");
    expect(result).toContain("Megapowers Protocol");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes protocol section"`

Expected: FAIL — `expected "## Megapowers — Idle Mode\n\nNo active issue..." to contain "megapowers_signal"`. The minimal idle prompt from Task 2 doesn't include the protocol.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, update `buildIdlePrompt`:

```typescript
function buildIdlePrompt(_cwd: string, _store?: Store): string | null {
  const parts: string[] = [];

  // Base protocol
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  return parts.length > 0 ? parts.join("\n\n") : null;
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes protocol section"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 4: Idle prompt includes open issues with milestone and priority [depends: 1, 2]

**Covers AC 4**

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add the `createStore` import at the top of `tests/prompt-inject.test.ts`:

```typescript
import { createStore } from "../extensions/megapowers/state/store.js";
```

Add to the `"buildInjectedPrompt — idle mode"` describe block:

```typescript
  it("includes open issues list with id, title, milestone, and priority (AC4)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);
    store.createIssue("Auth refactor", "feature", "Refactor auth module");

    // Write milestone and priority into the issue frontmatter
    const { writeFileSync, readFileSync } = require("node:fs");
    const issuePath = join(tmp, ".megapowers", "issues", "001-auth-refactor.md");
    const content = readFileSync(issuePath, "utf-8");
    const updated = content.replace("status: open", "status: open\nmilestone: M2\npriority: 2");
    writeFileSync(issuePath, updated);

    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(result).toContain("Open Issues");
    expect(result).toContain("Auth refactor");
    expect(result).toContain("M2");
    expect(result).toContain("priority");
  });

  it("excludes done issues from idle prompt (AC4)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);
    store.createIssue("Open task", "feature", "Still open");
    store.createIssue("Done task", "bugfix", "Already done");
    store.updateIssueStatus("002-done-task", "done");

    const result = buildInjectedPrompt(tmp, store);
    expect(result).toContain("Open task");
    expect(result).not.toContain("Done task");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes open issues list"`

Expected: FAIL — `expected "## Megapowers Protocol..." to contain "Open Issues"`. The idle prompt from Task 3 only has the protocol section, no issues list.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, update `buildIdlePrompt` to add issue listing after the protocol section:

```typescript
function buildIdlePrompt(_cwd: string, store?: Store): string | null {
  const parts: string[] = [];

  // Base protocol
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  // Open issues
  if (store) {
    const issues = store.listIssues().filter(i => i.status !== "done");
    if (issues.length > 0) {
      const issueLines = issues.map(i =>
        `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority})`
      );
      parts.push(`## Open Issues\n\n${issueLines.join("\n")}`);
    } else {
      parts.push("## Open Issues\n\nNo open issues. Use `/issue new` to create one.");
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "open issues"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 5: Idle prompt includes slash commands [depends: 2]

**Covers AC 5**

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — idle mode"` describe block:

```typescript
  it("includes slash command hints (AC5)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("/issue new");
    expect(result).toContain("/issue list");
    expect(result).toContain("/triage");
    expect(result).toContain("/mega on|off");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes slash command hints"`

Expected: FAIL — `expected "## Megapowers Protocol..." to contain "/issue new"`. The idle prompt doesn't yet include slash commands.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add to `buildIdlePrompt` after the open issues block:

```typescript
  // Slash commands
  parts.push(`## Available Commands

- \`/issue new\` — create a new issue
- \`/issue list\` — pick an issue to work on
- \`/triage\` — batch and prioritize open issues
- \`/mega on|off\` — enable/disable workflow enforcement`);
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes slash command hints"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 6: Idle prompt includes roadmap and milestones reference [depends: 2]

**Covers AC 6**

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — idle mode"` describe block:

```typescript
  it("includes roadmap and milestones reference (AC6)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("ROADMAP.md");
    expect(result).toContain(".megapowers/milestones.md");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes roadmap and milestones reference"`

Expected: FAIL — `expected "## Megapowers Protocol..." to contain "ROADMAP.md"`. The idle prompt doesn't yet include the roadmap reference.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add to `buildIdlePrompt` after the slash commands block:

```typescript
  // Roadmap reference
  parts.push("See `ROADMAP.md` and `.megapowers/milestones.md` for what's next.");
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes roadmap and milestones reference"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 7: Dashboard idle mode includes /triage and /mega hints

**Covers AC 7**

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add a new describe block in `tests/ui.test.ts` after the existing `"renderDashboardLines — no active issue"` block:

```typescript
describe("renderDashboardLines — idle mode command hints", () => {
  it("includes /triage command hint (AC7)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("/triage");
  });

  it("includes /mega on|off command hint (AC7)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("/mega");
  });
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/ui.test.ts -t "includes /triage command hint"`

Expected: FAIL — `expected "No active issue.\n/issue new  — create an issue\n/issue list — pick an issue to work on" to contain "/triage"`. The current idle dashboard only shows `/issue new` and `/issue list`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, modify the no-active-issue block in `renderDashboardLines` (lines 74-79). Replace:

```typescript
  if (!state.activeIssue) {
    lines.push(theme.fg("dim", "No active issue."));
    lines.push(`${theme.fg("accent", "/issue new")}  — create an issue`);
    lines.push(`${theme.fg("accent", "/issue list")} — pick an issue to work on`);
    return lines;
  }
```

With:

```typescript
  if (!state.activeIssue) {
    lines.push(theme.fg("dim", "No active issue."));
    lines.push(`${theme.fg("accent", "/issue new")}  — create an issue`);
    lines.push(`${theme.fg("accent", "/issue list")} — pick an issue to work on`);
    lines.push(`${theme.fg("accent", "/triage")}     — batch and prioritize issues`);
    lines.push(`${theme.fg("accent", "/mega on|off")} — enable/disable workflow enforcement`);
    return lines;
  }
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/ui.test.ts -t "idle mode command hints"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing (existing "shows no-issue message with commands" test still passes since it only checks for `/issue new` and `/issue list` which are still present)

---

### Task 8: Dashboard idle mode includes roadmap reference [depends: 7]

**Covers AC 8**

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to the `"renderDashboardLines — idle mode command hints"` describe block in `tests/ui.test.ts`:

```typescript
  it("includes roadmap and milestones reference (AC8)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("ROADMAP.md");
    expect(joined).toContain("milestones.md");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/ui.test.ts -t "includes roadmap and milestones reference"`

Expected: FAIL — `expected "No active issue.\n/issue new..." to contain "ROADMAP.md"`. Task 7's implementation added command hints but not the roadmap reference.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, add one line in the no-active-issue block, before the `return lines;`:

```typescript
    lines.push(theme.fg("dim", "See ROADMAP.md and .megapowers/milestones.md for what's next."));
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/ui.test.ts -t "includes roadmap and milestones reference"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 9: Dashboard active issue mode is unchanged [depends: 7, 8] [no-test-first]

**Covers AC 9**

**Justification:** This is a regression guard — the test asserts that active-issue dashboard output does NOT contain idle-mode hints. No implementation changes are needed; this test codifies existing correct behavior after Tasks 7-8 modified the idle path.

**Files:**
- Test: `tests/ui.test.ts`

**Step 1 — Write the regression guard test**

Add a new describe block in `tests/ui.test.ts`:

```typescript
describe("renderDashboardLines — active issue has no idle hints (AC9)", () => {
  it("active issue dashboard does not contain idle-mode hints", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "plan",
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    // Active issue dashboard should NOT have idle hints
    expect(joined).not.toContain("/triage");
    expect(joined).not.toContain("/mega");
    expect(joined).not.toContain("ROADMAP.md");
    // But should still have the active issue info
    expect(joined).toContain("001-auth");
    expect(joined).toContain("plan");
  });
});
```

**Step 2 — Run test, verify it passes**

Run: `bun test tests/ui.test.ts -t "active issue has no idle hints"`

Expected: PASS — the active-issue branch in `renderDashboardLines` is a separate code path that doesn't include idle hints.

**Step 3 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 10: megapowers-protocol.md — add phase_back and verify learnings [no-test]

**Covers AC 10, 11**

**Justification:** Markdown prompt template change. No runtime code affected — only injected LLM prompt content changes. Verified by content inspection.

**Files:**
- Modify: `prompts/megapowers-protocol.md`

**Step 1 — Make the change**

In `prompts/megapowers-protocol.md`, after line 11 (`tests_passed` signal), add:

```
- `{ action: "phase_back" }` — Go back to the previous phase (verify→implement, code-review→implement, review→plan)
```

Verify that `learnings` is already present in the valid phases list on line 16. Current content:
```
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
```
`learnings` is already listed — no change needed for AC11.

**Step 2 — Verify**

Run: `grep "phase_back" prompts/megapowers-protocol.md`

Expected: one match showing the new signal line.

Run: `grep "learnings" prompts/megapowers-protocol.md`

Expected: one match in the valid phases list.

Run: `bun test`

Expected: all passing

---

### Task 11: review-plan.md — fix numbering and add phase_back reference [no-test]

**Covers AC 12, 13**

**Justification:** Markdown prompt template correction. No runtime code changes.

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

1. Fix duplicate section numbering. Change the second `### 5.` heading (line 49, "Self-Containment") to `### 6.`:

Replace:
```
### 5. Self-Containment
```
With:
```
### 6. Self-Containment
```

2. In the "After Review" section (line 85), replace the phase transition instruction:

Replace:
```
If the plan needs revision, present specific feedback to the user. When confirmed, the plan phase will need to be revisited.
```
With:
```
If the plan needs revision, present specific feedback to the user. Use `megapowers_signal({ action: "phase_back" })` to go back to the plan phase for revisions.
```

**Step 2 — Verify**

Run: `grep -n "### [0-9]" prompts/review-plan.md`

Expected: Sequential numbering 1 through 6 with no duplicates.

Run: `grep "phase_back" prompts/review-plan.md`

Expected: one match.

Run: `bun test`

Expected: all passing

---

### Task 12: implement-task.md — tighten Execution Mode [no-test]

**Covers AC 14**

**Justification:** Markdown prompt template refinement. No runtime code changes.

**Files:**
- Modify: `prompts/implement-task.md`

**Step 1 — Make the change**

Replace lines 24-66 (the entire `## Execution Mode` section) with a tightened version:

```markdown
## Execution Mode

### Work inline (default)
Implement directly in this session. TDD is enforced via tdd-guard.

### Delegate to subagent
If the `subagent` tool is available and the task is marked `[ready — can be delegated to subagent]`, delegate for parallel execution.

**Subagent mechanics:**
- Runs in an isolated jj workspace — no file conflicts with your session
- Receives task description, plan, spec, and project learnings as context
- jj/workspace management is automatic — you don't manage it

**Invoke:**
```
subagent({ agent: "worker", task: "Implement Task N: <description>. Follow TDD: write failing test, make it pass, refactor. Files: <files>. Plan context: <task section>", taskIndex: N })
```

**After dispatch:**
1. Continue your own task — don't wait
2. Check periodically: `subagent_status({ id: "<id>" })`
3. On `completed` + `testsPassed: true`: re-read shared files, then `megapowers_signal({ action: "task_done" })`
4. On `failed` or `testsPassed: false`: read error/diff, retry or complete inline

**Do NOT delegate when:**
- Task depends on incomplete tasks (`[blocked]`)
- Only one remaining task
- Task modifies same files or test files as your current task
```

**Step 2 — Verify**

Run: `wc -l prompts/implement-task.md`

Expected: shorter than before (was 129 lines, target ~105-115).

Run: `bun test`

Expected: all passing

---

### Task 13: verify.md — replace /phase references with phase_back [no-test]

**Covers AC 15**

**Justification:** Markdown prompt template correction. Replacing stale `/phase` slash command reference with correct `megapowers_signal` call. No runtime code changes.

**Files:**
- Modify: `prompts/verify.md`

**Step 1 — Make the change**

On line 80, replace:

```
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap). The user will need to use `/phase implement` or `/phase plan` to transition back.
```

With:

```
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap). Use `megapowers_signal({ action: "phase_back" })` to transition back.
```

**Step 2 — Verify**

Run: `grep "/phase" prompts/verify.md`

Expected: no matches — all `/phase` references should be gone.

Run: `grep "phase_back" prompts/verify.md`

Expected: one match.

Run: `bun test`

Expected: all passing

---

### Task 14: code-review.md — replace /phase references with phase_back in needs-fixes and needs-rework [no-test]

**Covers AC 16**

**Justification:** Markdown prompt template correction. Replacing stale `/phase` slash command references with correct `megapowers_signal` calls. No runtime code changes.

**Files:**
- Modify: `prompts/code-review.md`

**Step 1 — Make the change**

**In the needs-fixes section** (line 89), replace:

```
- If needs-fixes: implement fixes in this session, re-run tests, update the review
```

With:

```
- If needs-fixes: implement fixes in this session, re-run tests, update the review. Use `megapowers_signal({ action: "phase_back" })` if changes require going back to implement.
```

**In the needs-rework section** (lines 109-112), replace:

```
### If **needs-rework**
Structural problems that can't be patched (wrong abstraction, missing component, broken architecture). Don't try to fix inline:
1. Save the review report with detailed findings
2. Recommend going back to **implement** (fixable with targeted task changes) or **plan** (fundamental design issue)
3. Present the recommendation to the user — they will need to use `/phase implement` or `/phase plan` to transition back
```

With:

```
### If **needs-rework**
Structural problems that can't be patched (wrong abstraction, missing component, broken architecture). Don't try to fix inline:
1. Save the review report with detailed findings
2. Recommend going back to **implement** (fixable with targeted task changes) or **plan** (fundamental design issue)
3. Use `megapowers_signal({ action: "phase_back" })` to transition back to implement, or recommend returning to plan for fundamental issues
```

**Step 2 — Verify**

Run: `grep "/phase" prompts/code-review.md`

Expected: no matches — all `/phase` references should be gone.

Run: `grep "phase_back" prompts/code-review.md`

Expected: two matches — one in needs-fixes section, one in needs-rework section.

Run: `bun test`

Expected: all passing