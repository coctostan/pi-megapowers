# Plan: Agent Context & Awareness (#050)

## AC ↔ Task Mapping

| AC | Task(s) | Description |
|----|---------|-------------|
| 1  | 1       | buildInjectedPrompt returns content when mega enabled + no active issue |
| 2  | 1       | buildInjectedPrompt returns null when mega disabled |
| 3  | 2       | Idle prompt includes protocol section |
| 4  | 3       | Idle prompt includes open issues list |
| 5  | 4       | Idle prompt includes slash command hints |
| 6  | 4       | Idle prompt includes roadmap/milestones reference |
| 7  | 5       | Dashboard idle mode includes /issue, /triage, /mega hints |
| 8  | 5       | Dashboard idle mode includes roadmap reference |
| 9  | 5       | Dashboard active issue unchanged |
| 10 | 6       | Protocol template lists phase_back signal |
| 11 | 6       | Protocol template lists learnings artifact phase |
| 12 | 7       | review-plan.md section numbering fixed |
| 13 | 7       | review-plan.md references phase_back |
| 14 | 8       | implement-task.md Execution Mode tightened |
| 15 | 9       | verify.md references phase_back |
| 16 | 9       | code-review.md references phase_back |

---

### Task 1: buildInjectedPrompt idle-mode returns content [no-test-first]

**Covers AC 1, 2**

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

In `tests/prompt-inject.test.ts`, add a new describe block after the existing ones:

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

  it("returns null when megaEnabled is false regardless of active issue (AC2)", () => {
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

Run: `bun test tests/prompt-inject.test.ts`

Expected: FAIL — "returns non-null when megaEnabled is true and no active issue" fails because `buildInjectedPrompt` currently returns null when there's no active issue (line 28: `if (!state.activeIssue || !state.phase) return null;`). The AC2 tests should already pass since the existing code returns null for megaEnabled=false.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, modify `buildInjectedPrompt()`. Change the early return on line 28 to branch into idle mode instead:

Replace:
```typescript
  if (!state.activeIssue || !state.phase) return null;
```

With:
```typescript
  if (!state.activeIssue || !state.phase) {
    // Idle mode: mega enabled but no active issue
    return buildIdlePrompt(cwd, store);
  }
```

Add a new function before or after `buildInjectedPrompt`:

```typescript
function buildIdlePrompt(cwd: string, store?: Store): string | null {
  const parts: string[] = [];

  // Base protocol
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  // Open issues
  if (store) {
    const issues = store.listIssues().filter(i => i.status !== "done");
    if (issues.length > 0) {
      const issueLines = issues.map(i =>
        `- #${String(i.id).padStart(3, "0")} ${i.title} [${i.type}] [${i.status}]`
      );
      parts.push(`## Open Issues\n\n${issueLines.join("\n")}`);
    } else {
      parts.push("## Open Issues\n\nNo open issues. Use `/issue new` to create one.");
    }
  }

  // Slash commands
  parts.push(`## Available Commands

- \`/issue new\` — create a new issue
- \`/issue list\` — pick an issue to work on
- \`/triage\` — batch and prioritize open issues
- \`/mega on|off\` — enable/disable workflow enforcement`);

  // Roadmap reference
  parts.push("See `ROADMAP.md` and `.megapowers/milestones.md` for what's next.");

  return parts.length > 0 ? parts.join("\n\n") : null;
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 2: Idle prompt includes protocol section [depends: 1]

**Covers AC 3**

**Files:**
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — idle mode"` describe block from Task 1:

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

Expected: PASS — if Task 1 was implemented correctly, the idle prompt already includes the protocol. This test codifies the AC3 requirement. If it fails, the protocol file loading in `buildIdlePrompt` isn't working.

**Step 3 — Write minimal implementation**

No additional implementation needed — Task 1's `buildIdlePrompt` already loads the protocol via `loadPromptFile("megapowers-protocol.md")`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes protocol section"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 3: Idle prompt includes open issues list [depends: 1]

**Covers AC 4**

**Files:**
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — idle mode"` describe block:

```typescript
  it("includes open issues list with id, title, type, and status (AC4)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    // Create a mock store with open issues
    const store = createStore(tmp);
    store.createIssue("Auth refactor", "feature", "Refactor auth module");
    store.createIssue("Login bug", "bugfix", "Login fails on mobile");
    store.updateIssueStatus("002-login-bug", "done");

    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(result).toContain("Open Issues");
    expect(result).toContain("Auth refactor");
    // Done issues should not appear
    expect(result).not.toContain("Login bug");
  });
```

This requires adding the store import to the test file. Add at the top of `tests/prompt-inject.test.ts`:

```typescript
import { createStore } from "../extensions/megapowers/state/store.js";
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes open issues list"`

Expected: FAIL — `buildInjectedPrompt(tmp)` without a store won't have issues. Passing a store should work if Task 1 implementation is correct. If it fails, it's because the store parameter isn't being passed through to `buildIdlePrompt`.

**Step 3 — Write minimal implementation**

Task 1's implementation already passes `store` to `buildIdlePrompt`. If the test fails, ensure the `store` parameter flows correctly. No additional changes expected.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes open issues list"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 4: Idle prompt includes slash commands and roadmap reference [depends: 1]

**Covers AC 5, 6**

**Files:**
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

  it("includes roadmap and milestones reference (AC6)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("ROADMAP.md");
    expect(result).toContain(".megapowers/milestones.md");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes slash command"`

Expected: PASS — Task 1's implementation already includes these. These tests codify the specific requirements.

**Step 3 — Write minimal implementation**

No additional implementation needed — covered by Task 1.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes slash command|includes roadmap"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 5: Enhanced idle dashboard with command hints and roadmap reference

**Covers AC 7, 8, 9**

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add a new describe block in `tests/ui.test.ts` (after the existing "renderDashboardLines — no active issue" block):

```typescript
describe("renderDashboardLines — idle mode enhanced hints", () => {
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

  it("includes roadmap and milestones reference (AC8)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("ROADMAP.md");
    expect(joined).toContain("milestones.md");
  });

  it("active issue dashboard is unchanged (AC9)", () => {
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

**Step 2 — Run test, verify it fails**

Run: `bun test tests/ui.test.ts -t "idle mode enhanced"`

Expected: FAIL — the current idle mode only shows "/issue new" and "/issue list". Tests for "/triage", "/mega", and roadmap reference will fail.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, modify the `renderDashboardLines` function's no-active-issue block. Replace:

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
    lines.push(theme.fg("dim", "See ROADMAP.md and .megapowers/milestones.md for what's next."));
    return lines;
  }
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/ui.test.ts -t "idle mode enhanced"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing (existing "no active issue" test still passes since it only checks for `/issue new` and `/issue list` which are still present)

---

### Task 6: megapowers-protocol.md — add phase_back and learnings [no-test]

**Covers AC 10, 11**

**Justification:** This is a markdown prompt template change. No runtime code is affected — only the content injected into LLM prompts changes. Verified by content inspection.

**Files:**
- Modify: `prompts/megapowers-protocol.md`

**Step 1 — Make the change**

In `prompts/megapowers-protocol.md`:

1. Add `phase_back` to the signal list. After the `tests_passed` line (line 11), add:
```
- `{ action: "phase_back" }` — Go back to the previous phase (verify→implement, code-review→implement, review→plan)
```

2. Add `learnings` to the valid phases list. On the line that lists valid phases (line 16), change:
```
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
```
Wait — `learnings` is already listed. Verify this. If already present, no change needed for AC11. If not, add it.

Actually, reading the current file content: line 16 says:
```
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
```
`learnings` is already present. So only the `phase_back` addition is needed.

The final `megapowers-protocol.md` should read:

```markdown
## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "phase_next" }` — Advance to the next workflow phase
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approve the plan during review phase
- `{ action: "tests_failed" }` — Signal that tests failed (RED in TDD cycle — unlocks production code writes)
- `{ action: "tests_passed" }` — Signal that tests passed (GREEN in TDD cycle)
- `{ action: "phase_back" }` — Go back to the previous phase (verify→implement, code-review→implement, review→plan)

### `megapowers_save_artifact`
Call this to save phase output:
- `{ phase: "<phase>", content: "<full content>" }` — Save artifact for the current phase
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
- Always save your work before advancing to the next phase

### Version Control
Version control is managed automatically via jj. **Do not run jj or git commands.** Phase changes, bookmarks, and commits are handled by the system.

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly. Do NOT edit `.megapowers/state.json`.
```

**Step 2 — Verify**

Run: `grep "phase_back" prompts/megapowers-protocol.md`

Expected: one match showing the new signal line.

Run: `grep "learnings" prompts/megapowers-protocol.md`

Expected: one match in the valid phases list.

Run: `bun test`

Expected: all passing (no code changes, only prompt content)

---

### Task 7: review-plan.md — fix numbering and add phase_back reference [no-test]

**Covers AC 12, 13**

**Justification:** Markdown prompt template correction. No runtime code changes.

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

1. Fix duplicate section numbering: Change the second `### 5.` (line 49, "Self-Containment") to `### 6.`:

Replace:
```
### 5. Self-Containment
```
With:
```
### 6. Self-Containment
```

2. In the "After Review" section (line 80+), add a phase_back reference. After the line about revision feedback, add:

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

### Task 8: implement-task.md — tighten Execution Mode [no-test]

**Covers AC 14**

**Justification:** Markdown prompt template refinement. No runtime code changes.

**Files:**
- Modify: `prompts/implement-task.md`

**Step 1 — Make the change**

Replace the entire "## Execution Mode" section (lines 24-66) with a tightened version that preserves all information but reduces verbosity:

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

Expected: shorter than before (was 129 lines, target ~110-115).

Run: `bun test`

Expected: all passing

---

### Task 9: verify.md and code-review.md — replace /phase references with phase_back [no-test]

**Covers AC 15, 16**

**Justification:** Markdown prompt template corrections. Replacing stale `/phase` slash command references with correct `megapowers_signal` calls. No runtime code changes.

**Files:**
- Modify: `prompts/verify.md`
- Modify: `prompts/code-review.md`

**Step 1 — Make the change**

**In `prompts/verify.md`** (line 80):

Replace:
```
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap). The user will need to use `/phase implement` or `/phase plan` to transition back.
```
With:
```
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap). Use `megapowers_signal({ action: "phase_back" })` to transition back.
```

**In `prompts/code-review.md`** (lines 90-91, 112-113):

In the "needs-fixes" section (around line 90), replace:
```
- If needs-fixes: implement fixes in this session, re-run tests, update the review
```
No change needed here — this doesn't reference `/phase`.

In the "needs-rework" section (lines 109-113), replace:
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

Run: `grep "/phase" prompts/verify.md prompts/code-review.md`

Expected: no matches — all `/phase` references should be gone.

Run: `grep "phase_back" prompts/verify.md prompts/code-review.md`

Expected: one match in each file.

Run: `bun test`

Expected: all passing
