---
id: 4
title: Replace full protocol with compact header for active issues
status: approved
depends_on:
  - 1
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/prompt-inject.test.ts`

Covers AC1–AC16, AC26, AC27. Replaces the unconditional `loadPromptFile("megapowers-protocol.md")` push (line 120–121) in `buildInjectedPrompt` for active issues with a compact `## Megapowers` header sourced from `getAllowedActions` (Task 1). All artifact loading, template rendering, derived tool instructions, advisory subagent handling, focused-review artifacts, and source-issue context (lines 122–262) remain unchanged.

The compact header includes: phase label (with plan mode when applicable), issue slug, current task (implement only), allowed actions, allowed `megapowers_plan_task`/`megapowers_plan_review` lines, phase warnings, phase notes (done), and the two universal rules:
- `Do not edit .megapowers/state.json.`
- `If a Megapowers tool errors, follow its message and retry.`

**Step 1 — Write the failing test**

Append to `tests/prompt-inject.test.ts`:

```ts
describe("buildInjectedPrompt — compact active-issue header", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "compact-active-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("does NOT include `## Megapowers Protocol` for active issues (AC1)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).not.toContain("## Megapowers Protocol");
  });

  it("includes `## Megapowers` header and issue slug (AC2, AC4)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("## Megapowers");
    expect(r).toContain("001-test");
  });

  it("plan/draft header shows `plan (draft)` and lists plan_task + plan_draft_done; warns vs phase_next (AC3, AC9)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("plan (draft)");
    expect(r).toContain("megapowers_plan_task");
    expect(r).toContain("plan_draft_done");
    expect(r).toContain("phase_next");
  });

  it("plan/revise header shows `plan (revise)` and lists plan_task + plan_draft_done (AC10)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("plan (revise)");
    expect(r).toContain("megapowers_plan_task");
    expect(r).toContain("plan_draft_done");
  });

  it("plan/review header lists megapowers_plan_review with approve+revise; warns vs review_approve and phase_next (AC11, AC16)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("megapowers_plan_review");
    expect(r).toMatch(/approve/);
    expect(r).toMatch(/revise/);
    expect(r).toContain("review_approve");
    // Header section must not advertise review_approve as allowed
    const headerEnd = r.indexOf("## ", r.indexOf("## Megapowers") + 1);
    const header = headerEnd === -1 ? r : r.slice(0, headerEnd);
    expect(header).not.toContain('action: "review_approve"');
  });

  it("implement header lists tests_failed, tests_passed, task_done (AC12)", () => {
    const dir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build it\n");
    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("tests_failed");
    expect(r).toContain("tests_passed");
    expect(r).toContain("task_done");
    // AC5: current task surfaced
    expect(r).toContain("Build it");
  });

  it("verify header lists phase_next and phase_back (AC13)", () => {
    setState(tmp, { phase: "verify", megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("phase_next");
    expect(r).toContain("phase_back");
  });

  it("code-review header lists phase_next and phase_back (AC14)", () => {
    setState(tmp, { phase: "code-review", megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("phase_next");
    expect(r).toContain("phase_back");
  });

  it("done header notes push/PR + cleanup and lists close_issue (AC15)", () => {
    setState(tmp, { phase: "done", megaEnabled: true, doneActions: ["close-issue"] });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("close_issue");
    expect(r.toLowerCase()).toMatch(/push|pr|cleanup/);
  });

  it("includes universal rules (AC7, AC8)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("Do not edit .megapowers/state.json.");
    expect(r.toLowerCase()).toContain("follow its message");
  });

  it("active-issue prompt does NOT include `## Open Issues` or `## Available Commands` (AC26, AC27)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).not.toContain("## Open Issues");
    expect(r).not.toContain("## Available Commands");
  });

  it("preserves phase template after the compact header (AC17)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const r = buildInjectedPrompt(tmp)!;
    expect(r).toContain("You are writing a step-by-step implementation plan");
  });
});
```

(The pre-existing tests in this file that expect `"Megapowers Protocol"`/`"Artifact Persistence"` for active issues — namely the `"includes megapowers protocol section with tool descriptions"` test at line 35 — should be updated/removed in this same task because they encode the now-superseded behavior. Replace its body to assert `"## Megapowers"` and `"megapowers_signal"` only.)

Edit the pre-existing test in `tests/prompt-inject.test.ts` at lines 35–41:

```ts
  it("includes compact megapowers header for active issues", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("## Megapowers");
    expect(result).not.toContain("## Megapowers Protocol");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts`
Expected: FAIL — at minimum `expect(received).not.toContain(expected) — Expected substring: "## Megapowers Protocol"` (current code unconditionally loads megapowers-protocol.md for active issues).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`:

1. Add this import near the other workflow imports:

```ts
import { getAllowedActions } from "./workflows/allowed-actions.js";
```

2. Add a helper at module scope (between the existing helpers and `buildInjectedPrompt`):

```ts
function buildCompactHeader(
  cwd: string,
  state: ReturnType<typeof readState>,
): string {
  const phase = state.phase!;
  const slug = state.activeIssue!;
  const allowed = getAllowedActions(phase, state.planMode);

  const phaseLabel = phase === "plan" && state.planMode ? `plan (${state.planMode})` : phase;

  const lines: string[] = [
    "## Megapowers",
    "",
    `Active phase: ${phaseLabel}`,
    `Current issue: ${slug}`,
  ];

  if (phase === "implement") {
    const tasks = deriveTasks(cwd, slug);
    const current = tasks[state.currentTaskIndex];
    if (current) {
      lines.push(`Current task: Task ${current.index}: ${current.description}`);
    }
  }

  lines.push("");
  lines.push("Allowed now:");
  for (const action of allowed.signalActions) {
    lines.push(`- \`megapowers_signal({ action: "${action}" })\``);
  }
  if (allowed.planTask) {
    lines.push("- `megapowers_plan_task(...)` to create/update structured plan tasks.");
  }
  if (allowed.planReview) {
    lines.push('- `megapowers_plan_review({ verdict: "approve", ... })`');
    lines.push('- `megapowers_plan_review({ verdict: "revise", ... })`');
  }
  for (const note of allowed.notes) lines.push(`- ${note}`);

  lines.push("");
  lines.push("Rules:");
  for (const w of allowed.warnings) lines.push(`- ${w}`);
  lines.push("- Do not edit .megapowers/state.json.");
  lines.push("- If a Megapowers tool errors, follow its message and retry rather than working around it.");

  return lines.join("\n");
}
```

3. In `buildInjectedPrompt`, replace the two-line block at lines 119–121:

```ts
  // Base protocol — always included so LLM knows about the tools (AC41)
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);
```

with:

```ts
  // Compact phase-aware header (replaces the full protocol injection for active issues).
  parts.push(buildCompactHeader(cwd, state));
```

Leave the rest of `buildInjectedPrompt` (variable building, artifact loading, phase template rendering, derived tool instructions, source-issue context) unchanged so AC17–AC24 are preserved.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
