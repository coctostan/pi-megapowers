# Plan: Agent Context & Awareness (#050)

## Review Feedback Applied

- Adopted **Path A** from review feedback: add real `phase_back` support to `megapowers_signal` runtime + tool schema, then update prompt templates to reference it.
- Resolved AC mismatches called out in review for **AC10, AC13, AC15, AC16**.
- Kept idle prompt/dashboard work unchanged (Tasks 1–8), since review marked those as correct.

## AC ↔ Task Mapping

| AC | Task(s) | Description |
|----|---------|-------------|
| 1 | 2 | `buildInjectedPrompt()` returns non-null in idle mode when mega is enabled |
| 2 | 2 | `buildInjectedPrompt()` returns null when mega is disabled |
| 3 | 3 | Idle prompt includes protocol section |
| 4 | 1, 4 | Issue model supports milestone/priority and idle prompt lists them |
| 5 | 5 | Idle prompt includes slash command hints |
| 6 | 6 | Idle prompt includes roadmap/milestones reference |
| 7 | 7 | Idle dashboard includes `/triage` and `/mega on|off` hints |
| 8 | 8 | Idle dashboard includes roadmap/milestones line |
| 9 | 8 | Active-issue dashboard remains unchanged (regression guard) |
| 10 | 9, 10 | `phase_back` is implemented and documented in protocol prompt |
| 11 | 10 | Protocol prompt lists `learnings` artifact phase |
| 12 | 11 | `review-plan.md` numbering fixed (`### 6.`) |
| 13 | 11 | `review-plan.md` After Review references `phase_back` |
| 14 | 12 | `implement-task.md` Execution Mode tightened |
| 15 | 13 | `verify.md` references `phase_back` (not `/phase ...`) |
| 16 | 14 | `code-review.md` references `phase_back` in needs-fixes + needs-rework |

---

### Task 1: Add milestone and priority fields to Issue model (prerequisite for AC4)

**Covers:** AC4 prerequisite

**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Test: `tests/store.test.ts`

**Step 1 — Write the failing test**

Add inside `describe("issues", ...)` in `tests/store.test.ts`:

```typescript
it("parses milestone and priority from frontmatter", () => {
  const { writeFileSync, mkdirSync } = require("node:fs");
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
  expect(issues).toHaveLength(1);
  expect(issues[0].milestone).toBe("M2");
  expect(issues[0].priority).toBe(2);
});

it("defaults milestone to empty string and priority to 0", () => {
  const issue = store.createIssue("No metadata", "feature", "Bare issue");
  const fetched = store.getIssue(issue.slug);
  expect(fetched!.milestone).toBe("");
  expect(fetched!.priority).toBe(0);
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/store.test.ts -t "parses milestone and priority"`

Expected: FAIL — `Property 'milestone' does not exist on type 'Issue'` (or assertion fails with `undefined`).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/store.ts`:

1) Extend `Issue`:

```typescript
export interface Issue {
  id: number;
  slug: string;
  title: string;
  type: "feature" | "bugfix";
  status: IssueStatus;
  description: string;
  createdAt: number;
  sources: number[];
  milestone: string;
  priority: number;
}
```

2) Extend `parseIssueFrontmatter` return value:

```typescript
return {
  id: data.id ? parseInt(data.id) : undefined,
  type: data.type as "feature" | "bugfix" | undefined,
  status: data.status as IssueStatus | undefined,
  createdAt: data.created ? new Date(data.created).getTime() : undefined,
  description: body.replace(/^#[^\n]*\n*/, "").trim(),
  title: body.match(/^#\s+(.+)/)?.[1],
  sources,
  milestone: data.milestone ?? undefined,
  priority: data.priority ? parseInt(data.priority) : undefined,
};
```

3) In `listIssues()` and `getIssue()`, set defaults:

```typescript
milestone: parsed.milestone ?? "",
priority: parsed.priority ?? 0,
```

4) In `createIssue()`, initialize fields:

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

### Task 2: Add idle-mode branch in `buildInjectedPrompt` (AC1, AC2)

**Covers:** AC1, AC2

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to `tests/prompt-inject.test.ts`:

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

Also replace the old test:

```typescript
it("returns null when no active issue", () => {
  writeState(tmp, createInitialState());
  expect(buildInjectedPrompt(tmp)).toBeNull();
});
```

with:

```typescript
it("returns non-null idle content when no active issue and mega enabled", () => {
  writeState(tmp, createInitialState());
  expect(buildInjectedPrompt(tmp)).not.toBeNull();
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "returns non-null when megaEnabled is true and no active issue"`

Expected: FAIL — `expected null not to be null`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`:

```typescript
if (!state.megaEnabled) return null;
if (!state.activeIssue || !state.phase) {
  return buildIdlePrompt(cwd, store);
}
```

Add helper near the top-level functions:

```typescript
function buildIdlePrompt(_cwd: string, _store?: Store): string | null {
  return "## Megapowers — Idle Mode\n\nNo active issue. Use the commands below to get started.";
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "buildInjectedPrompt — idle mode"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 3: Idle prompt includes base protocol section [depends: 2]

**Covers:** AC3

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add in the idle-mode describe block:

```typescript
it("includes protocol section with tool names (AC3)", () => {
  writeState(tmp, { ...createInitialState(), megaEnabled: true });
  const result = buildInjectedPrompt(tmp);
  expect(result).not.toBeNull();
  expect(result).toContain("Megapowers Protocol");
  expect(result).toContain("megapowers_signal");
  expect(result).toContain("megapowers_save_artifact");
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes protocol section with tool names"`

Expected: FAIL — idle string does not contain `megapowers_signal`.

**Step 3 — Write minimal implementation**

Update `buildIdlePrompt`:

```typescript
function buildIdlePrompt(_cwd: string, _store?: Store): string | null {
  const parts: string[] = [];
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);
  return parts.length > 0 ? parts.join("\n\n") : null;
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts -t "includes protocol section with tool names"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 4: Idle prompt includes open issues with id/title/milestone/priority [depends: 1, 2]

**Covers:** AC4

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

At top of `tests/prompt-inject.test.ts`, add:

```typescript
import { createStore } from "../extensions/megapowers/state/store.js";
```

Then add tests:

```typescript
it("includes open issues list with id, title, milestone, and priority (AC4)", () => {
  writeState(tmp, { ...createInitialState(), megaEnabled: true });
  const store = createStore(tmp);
  store.createIssue("Auth refactor", "feature", "Refactor auth module");

  const issuePath = join(tmp, ".megapowers", "issues", "001-auth-refactor.md");
  const content = readFileSync(issuePath, "utf-8");
  writeFileSync(issuePath, content.replace("status: open", "status: open\nmilestone: M2\npriority: 2"));

  const result = buildInjectedPrompt(tmp, store);
  expect(result).toContain("Open Issues");
  expect(result).toContain("#001");
  expect(result).toContain("Auth refactor");
  expect(result).toContain("M2");
  expect(result).toContain("priority: 2");
});

it("does not include done issues in idle prompt", () => {
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

Expected: FAIL — prompt does not contain `Open Issues`.

**Step 3 — Write minimal implementation**

Update `buildIdlePrompt` to append open issues:

```typescript
if (store) {
  const issues = store.listIssues().filter(i => i.status !== "done");
  const issueLines = issues.map(i =>
    `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority})`
  );

  parts.push(
    issues.length > 0
      ? `## Open Issues\n\n${issueLines.join("\n")}`
      : "## Open Issues\n\nNo open issues. Use `/issue new` to create one."
  );
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

**Covers:** AC5

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

```typescript
it("includes slash command hints (AC5)", () => {
  writeState(tmp, { ...createInitialState(), megaEnabled: true });
  const result = buildInjectedPrompt(tmp);
  expect(result).toContain("/issue new");
  expect(result).toContain("/issue list");
  expect(result).toContain("/triage");
  expect(result).toContain("/mega on|off");
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes slash command hints"`

Expected: FAIL — prompt does not yet contain command list.

**Step 3 — Write minimal implementation**

Append command section in `buildIdlePrompt`:

```typescript
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

### Task 6: Idle prompt includes roadmap/milestones reference [depends: 2]

**Covers:** AC6

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

```typescript
it("includes roadmap and milestones reference (AC6)", () => {
  writeState(tmp, { ...createInitialState(), megaEnabled: true });
  const result = buildInjectedPrompt(tmp);
  expect(result).toContain("ROADMAP.md");
  expect(result).toContain(".megapowers/milestones.md");
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts -t "includes roadmap and milestones reference"`

Expected: FAIL — no roadmap line yet.

**Step 3 — Write minimal implementation**

Append line in `buildIdlePrompt`:

```typescript
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

**Covers:** AC7

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add a new describe block in `tests/ui.test.ts`:

```typescript
describe("renderDashboardLines — idle mode command hints", () => {
  it("includes /triage command hint (AC7)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n")).toContain("/triage");
  });

  it("includes /mega on|off command hint (AC7)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n")).toContain("/mega");
  });
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/ui.test.ts -t "includes /triage command hint"`

Expected: FAIL — idle dashboard only has `/issue new` and `/issue list`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, update the no-active-issue branch:

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

Expected: all passing

---

### Task 8: Dashboard idle mode includes roadmap reference + active issue regression guard [depends: 7]

**Covers:** AC8, AC9

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add in `describe("renderDashboardLines — idle mode command hints", ...)`:

```typescript
it("includes roadmap and milestones reference (AC8)", () => {
  const state = createInitialState();
  const lines = renderDashboardLines(state, [], plainTheme as any);
  const joined = lines.join("\n");
  expect(joined).toContain("ROADMAP.md");
  expect(joined).toContain("milestones.md");
});

it("active issue dashboard does not include idle hints (AC9)", () => {
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-auth",
    workflow: "feature",
    phase: "plan",
  };
  const joined = renderDashboardLines(state, [], plainTheme as any).join("\n");
  expect(joined).not.toContain("/triage");
  expect(joined).not.toContain("/mega");
  expect(joined).not.toContain("ROADMAP.md");
  expect(joined).toContain("001-auth");
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/ui.test.ts -t "includes roadmap and milestones reference"`

Expected: FAIL — no roadmap line in idle dashboard yet.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts` (idle branch), add before `return lines;`:

```typescript
lines.push(theme.fg("dim", "See ROADMAP.md and .megapowers/milestones.md for what's next."));
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/ui.test.ts -t "idle mode command hints"`

Expected: PASS (AC8 + AC9 tests pass)

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 9: Add `phase_back` action to `megapowers_signal` runtime + tool schema

**Covers:** AC10 prerequisite (real availability of `phase_back`)

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-signal.test.ts`:

```typescript
describe("phase_back", () => {
  it("moves review -> plan", () => {
    setState(tmp, { phase: "review", reviewApproved: true });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(readState(tmp).phase).toBe("plan");
  });

  it("moves verify -> implement", () => {
    setState(tmp, { phase: "verify" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(readState(tmp).phase).toBe("implement");
  });

  it("moves code-review -> implement", () => {
    setState(tmp, { phase: "code-review" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(readState(tmp).phase).toBe("implement");
  });

  it("returns error from unsupported phases", () => {
    setState(tmp, { phase: "brainstorm" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toContain("phase_back can only be used from review, verify, or code-review");
  });
});

it("megapowers_signal schema includes phase_back action", () => {
  const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
  expect(toolsSource).toContain('Type.Literal("phase_back")');
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "phase_back"`

Expected: FAIL — `Unknown signal action: phase_back`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`:

1) Expand action type and switch:

```typescript
export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next" | "phase_back" | string,
  jj?: JJ,
  target?: string,
): SignalResult {
  // ...
  switch (action) {
    case "task_done":
      return handleTaskDone(cwd, jj);
    case "review_approve":
      return handleReviewApprove(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, jj, target);
    case "phase_back":
      return handlePhaseBack(cwd, jj);
    // ...
  }
}
```

2) Add backward handler:

```typescript
function handlePhaseBack(cwd: string, jj?: JJ): SignalResult {
  const state = readState(cwd);

  const targetByPhase: Partial<Record<Phase, Phase>> = {
    review: "plan",
    verify: "implement",
    "code-review": "implement",
  };

  const target = state.phase ? targetByPhase[state.phase] : undefined;
  if (!target) {
    return { error: "phase_back can only be used from review, verify, or code-review." };
  }

  return handlePhaseNext(cwd, jj, target);
}
```

In `extensions/megapowers/register-tools.ts`:

- Add `phase_back` to tool description and `action` union:

```typescript
Type.Literal("phase_back"),
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "phase_back"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

---

### Task 10: Update `megapowers-protocol.md` for `phase_back` and `learnings` [depends: 9] [no-test]

**Covers:** AC10, AC11

**Justification:** Prompt-template documentation change; behavior already tested in Task 9.

**Files:**
- Modify: `prompts/megapowers-protocol.md`

**Step 1 — Make the change**

In `prompts/megapowers-protocol.md`, in `megapowers_signal` action list, add:

```markdown
- `{ action: "phase_back" }` — Go back one phase using workflow-defined backward transitions (review→plan, verify→implement, code-review→implement)
```

Ensure valid phases line contains `learnings` exactly:

```markdown
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
```

**Step 2 — Verify**

Run: `rg "phase_back|learnings" prompts/megapowers-protocol.md`

Expected: matches for both `phase_back` and `learnings`.

Run: `bun test`

Expected: all passing

---

### Task 11: Fix `review-plan.md` numbering + After Review `phase_back` reference [depends: 9] [no-test]

**Covers:** AC12, AC13

**Justification:** Prompt-template text correction only.

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

1) Fix duplicate heading:

```markdown
### 5. Self-Containment
```

to:

```markdown
### 6. Self-Containment
```

2) In `## After Review`, replace final sentence with:

```markdown
If the plan needs revision, present specific feedback to the user. Use `megapowers_signal({ action: "phase_back" })` to return from review to plan when revisions are needed.
```

**Step 2 — Verify**

Run: `rg "^### [0-9]\." prompts/review-plan.md`

Expected: sequential headings with no duplicate `### 5.`.

Run: `rg "phase_back" prompts/review-plan.md`

Expected: one match in `After Review` section.

Run: `bun test`

Expected: all passing

---

### Task 12: Tighten `implement-task.md` Execution Mode section [no-test]

**Covers:** AC14

**Justification:** Prompt clarity/verbosity reduction only.

**Files:**
- Modify: `prompts/implement-task.md`

**Step 1 — Make the change**

Replace the entire `## Execution Mode` section with this tightened version (same meaning, less verbosity):

```markdown
## Execution Mode
### Work inline (default)
Work directly in this session. TDD is enforced via tdd-guard.
### Delegate to subagent (when available)
If the `subagent` tool is available and there are independent remaining tasks, delegate them for parallel execution.
**How subagents work:**
- Each subagent runs in its own **jj workspace** (isolated copy)
- The subagent receives task description, plan context, spec, and learnings
- Workspace/jj management is automatic
**How to invoke:**
- `subagent({ agent: "worker", task: "Implement Task N: <description>. Follow TDD: write failing test, make it pass, refactor. Files: <files>. Plan context: <task section>", taskIndex: N })`
**After dispatching:**
1. Continue your own task
2. Poll with `subagent_status({ id: "<id>" })`
3. If `state: "completed"` and `testsPassed: true`, re-read overlapping files and call `megapowers_signal({ action: "task_done" })`
4. If failed, inspect error/diff and retry or complete inline
**Do NOT delegate when:**
- Task has unmet dependencies (`[blocked]`)
- Only one task remains
- Task touches same files or test files as your current task
```

**Step 2 — Verify**

Run: `rg -n "## Execution Mode|### Work inline|### Delegate to subagent" prompts/implement-task.md`

Expected: section exists with shortened wording.

Run: `bun test`

Expected: all passing

---

### Task 13: Update `verify.md` to use `phase_back` (remove `/phase ...`) [depends: 9] [no-test]

**Covers:** AC15

**Justification:** Prompt-template correction.

**Files:**
- Modify: `prompts/verify.md`

**Step 1 — Make the change**

Replace the stale line that currently says users need `/phase implement` or `/phase plan` with:

```markdown
- If any criterion fails: explain what's missing and recommend next steps. Use `megapowers_signal({ action: "phase_back" })` to return to implement for fixes. If planning is fundamentally wrong, call this out explicitly and recommend continuing backward through review→plan as needed.
```

**Step 2 — Verify**

Run: `rg "/phase|phase_back" prompts/verify.md`

Expected: no `/phase` matches; one `phase_back` match.

Run: `bun test`

Expected: all passing

---

### Task 14: Update `code-review.md` needs-fixes + needs-rework to use `phase_back` [depends: 9] [no-test]

**Covers:** AC16

**Justification:** Prompt-template correction.

**Files:**
- Modify: `prompts/code-review.md`

**Step 1 — Make the change**

1) In `### If **needs-fixes**`, add explicit transition guidance:

```markdown
- If needs-fixes: implement fixes in this session, re-run tests, update the review. Use `megapowers_signal({ action: "phase_back" })` to return to implement when required.
```

2) In `### If **needs-rework**`, replace stale `/phase implement` / `/phase plan` reference with:

```markdown
3. Use `megapowers_signal({ action: "phase_back" })` to move back to implement first; if deeper rework is needed, continue backward to plan via the workflow's backward transitions.
```

**Step 2 — Verify**

Run: `rg "/phase|phase_back" prompts/code-review.md`

Expected: no `/phase` matches; `phase_back` present in both needs-fixes and needs-rework sections.

Run: `bun test`

Expected: all passing
