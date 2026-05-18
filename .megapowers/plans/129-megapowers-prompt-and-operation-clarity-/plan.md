# Plan

### Task 1: Add allowed-actions mapping module

**Files:**
- Create: `extensions/megapowers/workflows/allowed-actions.ts`
- Create: `tests/allowed-actions.test.ts`

Provides the single source of truth for which megapowers actions are allowed in each `(phase, planMode)` state. Consumed by the compact header (Task 4) and used to enforce parity with `deriveToolInstructions` (Task 7).

**Step 1 — Write the failing test**

Create `tests/allowed-actions.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { getAllowedActions } from "../extensions/megapowers/workflows/allowed-actions.js";

describe("getAllowedActions", () => {
  it("plan/draft lists plan_task and plan_draft_done; warns against phase_next; no review_approve", () => {
    const a = getAllowedActions("plan", "draft");
    expect(a.signalActions).toContain("plan_draft_done");
    expect(a.planTask).toBe(true);
    expect(a.planReview).toBe(false);
    expect(a.signalActions).not.toContain("review_approve");
    expect(a.warnings.join("\n")).toContain("phase_next");
  });

  it("plan/revise lists plan_task and plan_draft_done; warns against phase_next", () => {
    const a = getAllowedActions("plan", "revise");
    expect(a.signalActions).toContain("plan_draft_done");
    expect(a.planTask).toBe(true);
    expect(a.warnings.join("\n")).toContain("phase_next");
  });

  it("plan/review lists plan_review (approve+revise) and warns against review_approve and forced phase_next", () => {
    const a = getAllowedActions("plan", "review");
    expect(a.planReview).toBe(true);
    expect(a.planTask).toBe(false);
    expect(a.signalActions).not.toContain("review_approve");
    expect(a.warnings.join("\n")).toContain("review_approve");
    expect(a.warnings.join("\n")).toContain("phase_next");
  });

  it("implement lists tests_failed, tests_passed, task_done", () => {
    const a = getAllowedActions("implement", null);
    expect(a.signalActions).toEqual(expect.arrayContaining(["tests_failed", "tests_passed", "task_done"]));
    expect(a.planTask).toBe(false);
    expect(a.planReview).toBe(false);
  });

  it("verify lists phase_next and phase_back", () => {
    const a = getAllowedActions("verify", null);
    expect(a.signalActions).toEqual(expect.arrayContaining(["phase_next", "phase_back"]));
  });

  it("code-review lists phase_next and phase_back", () => {
    const a = getAllowedActions("code-review", null);
    expect(a.signalActions).toEqual(expect.arrayContaining(["phase_next", "phase_back"]));
  });

  it("done lists close_issue and notes push/PR/cleanup", () => {
    const a = getAllowedActions("done", null);
    expect(a.signalActions).toContain("close_issue");
    expect(a.notes.join("\n").toLowerCase()).toMatch(/push|pr|cleanup/);
  });

  it("no allowed-actions entry advertises review_approve", () => {
    const phases = ["brainstorm", "spec", "plan", "implement", "verify", "code-review", "done", "reproduce", "diagnose"] as const;
    const modes = [null, "draft", "review", "revise"] as const;
    for (const p of phases) {
      for (const m of modes) {
        const a = getAllowedActions(p as any, m as any);
        expect(a.signalActions).not.toContain("review_approve");
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/allowed-actions.test.ts`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/workflows/allowed-actions.js' from '.../tests/allowed-actions.test.ts'`

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/workflows/allowed-actions.ts`:

```ts
import type { Phase, PlanMode } from "../state/state-machine.js";

export interface AllowedActions {
  /** megapowers_signal actions allowed (display + parity with deriveToolInstructions). */
  signalActions: string[];
  /** True if megapowers_plan_task may be called. */
  planTask: boolean;
  /** True if megapowers_plan_review may be called. */
  planReview: boolean;
  /** Phase notes shown in the compact header (e.g. push/PR allowed). */
  notes: string[];
  /** Phase warnings shown in the compact header (e.g. do not bypass review). */
  warnings: string[];
}

const EMPTY: AllowedActions = {
  signalActions: ["phase_next"],
  planTask: false,
  planReview: false,
  notes: [],
  warnings: [],
};

export function getAllowedActions(phase: Phase, planMode: PlanMode): AllowedActions {
  if (phase === "plan" && planMode === "draft") {
    return {
      signalActions: ["plan_draft_done"],
      planTask: true,
      planReview: false,
      notes: [],
      warnings: ["Do not bypass review by forcing phase_next from plan."],
    };
  }
  if (phase === "plan" && planMode === "revise") {
    return {
      signalActions: ["plan_draft_done"],
      planTask: true,
      planReview: false,
      notes: [],
      warnings: ["Do not bypass review by forcing phase_next from plan."],
    };
  }
  if (phase === "plan" && planMode === "review") {
    return {
      signalActions: [],
      planTask: false,
      planReview: true,
      notes: [],
      warnings: [
        "Do not use deprecated review_approve.",
        "Do not force phase_next from plan review.",
      ],
    };
  }
  if (phase === "implement") {
    return {
      signalActions: ["tests_failed", "tests_passed", "task_done"],
      planTask: false,
      planReview: false,
      notes: [],
      warnings: [],
    };
  }
  if (phase === "verify" || phase === "code-review") {
    return {
      signalActions: ["phase_next", "phase_back"],
      planTask: false,
      planReview: false,
      notes: [],
      warnings: [],
    };
  }
  if (phase === "done") {
    return {
      signalActions: ["close_issue"],
      planTask: false,
      planReview: false,
      notes: ["push-and-pr and post-merge cleanup are allowed in this phase."],
      warnings: [],
    };
  }
  // brainstorm/spec/reproduce/diagnose/plan (no mode) — single advance action
  return EMPTY;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/allowed-actions.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Add shared feedback vocabulary module

**Files:**
- Create: `extensions/megapowers/feedback.ts`
- Create: `tests/feedback.test.ts`

Single source of truth for the leading status icons/verbs and a `composeMessage()` helper that assembles "status — what changed → artifact path → next step" strings. Consumed by all tool feedback updates in later tasks.

**Step 1 — Write the failing test**

Create `tests/feedback.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { ICONS, composeMessage } from "../extensions/megapowers/feedback.js";

describe("feedback vocabulary", () => {
  it("exposes a status icon vocabulary", () => {
    expect(ICONS.success).toBe("✅");
    expect(ICONS.info).toBe("📋");
    expect(ICONS.warn).toBe("⚠️");
    expect(ICONS.error).toBe("❌");
    expect(ICONS.note).toBe("📝");
  });

  it("composeMessage prepends the requested status icon", () => {
    const out = composeMessage({ icon: "success", summary: "saved" });
    expect(out.startsWith("✅ saved")).toBe(true);
  });

  it("composeMessage includes artifact path line when provided", () => {
    const out = composeMessage({
      icon: "success",
      summary: "Task 1 saved",
      artifactPath: ".megapowers/plans/001-test/tasks/task-001.md",
      nextStep: "continue with task 2",
    });
    expect(out).toContain("→ .megapowers/plans/001-test/tasks/task-001.md");
    expect(out).toContain("Next: continue with task 2");
  });

  it("composeMessage omits artifact and next-step lines when not provided", () => {
    const out = composeMessage({ icon: "info", summary: "noop" });
    expect(out).toBe("📋 noop");
    expect(out).not.toContain("→");
    expect(out).not.toContain("Next:");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/feedback.test.ts`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/feedback.js'`

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/feedback.ts`:

```ts
// extensions/megapowers/feedback.ts
//
// Shared status vocabulary and result-message composer.
// Used by handleSignal, handlePlanTask, handlePlanReview, handlePlanDraftDone, handleCloseIssue.

export const ICONS = {
  success: "✅",
  info: "📋",
  warn: "⚠️",
  error: "❌",
  note: "📝",
} as const;

export type IconKey = keyof typeof ICONS;

export interface ComposeArgs {
  icon: IconKey;
  /** First-line summary after the icon. */
  summary: string;
  /** Optional bullets describing what changed. */
  changes?: string[];
  /** Optional saved artifact path under .megapowers/plans/<slug>/. */
  artifactPath?: string;
  /** Optional explicit next-step phrase. */
  nextStep?: string;
}

export function composeMessage(args: ComposeArgs): string {
  const lines: string[] = [`${ICONS[args.icon]} ${args.summary}`];
  if (args.changes) {
    for (const c of args.changes) lines.push(`  • ${c}`);
  }
  if (args.artifactPath) lines.push(`  → ${args.artifactPath}`);
  if (args.nextStep) lines.push(`  Next: ${args.nextStep}`);
  return lines.join("\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/feedback.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Add renderFullProtocolPrompt export

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/prompt-inject.test.ts`

Covers AC33, AC35 — expose a callable code path that renders the canonical full `## Megapowers Protocol` block from `prompts/megapowers-protocol.md`, independent of `buildInjectedPrompt`.

**Step 1 — Write the failing test**

Append to `tests/prompt-inject.test.ts`:

```ts
import { renderFullProtocolPrompt } from "../extensions/megapowers/prompt-inject.js";

describe("renderFullProtocolPrompt", () => {
  it("returns the canonical `## Megapowers Protocol` content (AC33, AC35)", () => {
    const out = renderFullProtocolPrompt();
    expect(out).toContain("## Megapowers Protocol");
    expect(out).toContain("megapowers_signal");
    expect(out).toContain("megapowers_plan_task");
    expect(out).toContain("megapowers_plan_review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts`
Expected: FAIL — `error: Export named 'renderFullProtocolPrompt' not found in module '.../prompt-inject.ts'`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add this exported function (anywhere at module scope, e.g. directly after the imports):

```ts
/**
 * Render the canonical full Megapowers protocol block from prompts/megapowers-protocol.md.
 * Reachable from tests and debug paths without going through buildInjectedPrompt.
 */
export function renderFullProtocolPrompt(): string {
  return loadPromptFile("megapowers-protocol.md");
}
```

(`loadPromptFile` is already imported.)

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Replace full protocol with compact header for active issues [depends: 1, 3]

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

### Task 5: Compact no-active-issue prompt [depends: 4]

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

### Task 6: Context debug report shows compact header [depends: 4]

**Files:**
- Modify: `tests/context-summary.test.ts`

Covers AC34. Adds a test that `renderContextReport(cwd, store, { debug: true })` includes the compact `## Megapowers` header for an active session. No implementation change is needed — `renderContextReport` already appends `buildInjectedPrompt(...)` in debug mode (context-summary.ts:188–192), and Task 4 makes that prompt contain `## Megapowers` instead of `## Megapowers Protocol`. This task isolates the behavioral assertion so failures in either direction surface here.

**Step 1 — Write the failing test**

Append inside `describe("context inspection debug report", ...)` in `tests/context-summary.test.ts`, right after the existing `it("includes an explicit rendered prompt section only in debug mode", ...)` test:

```ts
  it("debug report's rendered prompt section contains the compact `## Megapowers` header (AC34)", () => {
    const store = createStore(tmp);
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const debug = renderContextReport(tmp, store, { debug: true });

    expect(debug).toContain("## Rendered prompt");
    expect(debug).toContain("## Megapowers");
    expect(debug).not.toContain("## Megapowers Protocol");
  });
```

**Step 2 — Run test, verify it fails (or passes after Task 4)**

Before Task 4: this test would fail with `expect(received).not.toContain("## Megapowers Protocol")` because the rendered prompt still contains the full protocol heading.

Run: `bun test tests/context-summary.test.ts`
Expected (with Task 4 already landed): PASS — `renderContextReport(..., {debug: true})` includes the compact header.

If running this task before Task 4, the expected failure is: `Expected substring: "## Megapowers" — Received: ... "## Megapowers Protocol" ...` (the assertion `not.toContain("## Megapowers Protocol")` fails).

**Step 3 — Write minimal implementation**

No implementation change. The test is satisfied by Task 4's compact-header refactor.

If the test fails because Task 4 has not yet been applied, complete Task 4 first; the listed dependency `[depends: 4]` enforces this.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/context-summary.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Allowed-actions ↔ deriveToolInstructions parity test [depends: 1]

**Files:**
- Create: `tests/allowed-actions-parity.test.ts`

Covers AC25, AC58. Asserts that the compact-header's allowed-action mapping does not contradict what `deriveToolInstructions` says for the same phases. Per AC25 the two views must agree for `implement`, `verify`, `code-review`, `done`, and each plan mode.

`deriveToolInstructions` (extensions/megapowers/workflows/tool-instructions.ts:9–48) produces text instructions, not a structured action list, so parity here is the rule: any `megapowers_signal({ action: "X" })` literal mentioned by `deriveToolInstructions` for the phase must appear in `getAllowedActions(phase, planMode).signalActions`, and vice versa (modulo plan-review which suppresses `deriveToolInstructions`).

**Step 1 — Write the failing test**

Create `tests/allowed-actions-parity.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { getAllowedActions } from "../extensions/megapowers/workflows/allowed-actions.js";
import { deriveToolInstructions } from "../extensions/megapowers/workflows/tool-instructions.js";
import { getWorkflowConfig } from "../extensions/megapowers/workflows/registry.js";
import type { Phase, PlanMode } from "../extensions/megapowers/state/state-machine.js";

function extractSignalActions(text: string): Set<string> {
  const out = new Set<string>();
  // Match patterns like: action: "task_done"  /  action `"phase_next"`  /  action \"close_issue\"
  const re = /action[`"\\\s:]*"([a-z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return out;
}

function instructionFor(phase: Phase): string {
  const config = getWorkflowConfig("feature");
  const phaseConfig = config.phases.find(p => p.name === phase);
  if (!phaseConfig) return "";
  const isTerminal = config.phases[config.phases.length - 1].name === phase;
  return deriveToolInstructions(phaseConfig, "001-test", { isTerminal });
}

describe("allowed-actions ↔ deriveToolInstructions parity (AC25, AC58)", () => {
  const cases: Array<{ phase: Phase; planMode: PlanMode }> = [
    { phase: "implement", planMode: null },
    { phase: "verify", planMode: null },
    { phase: "code-review", planMode: null },
    { phase: "done", planMode: null },
  ];

  for (const { phase, planMode } of cases) {
    it(`derived instructions for ${phase} only mention actions that allowed-actions also lists`, () => {
      const allowed = new Set(getAllowedActions(phase, planMode).signalActions);
      const mentioned = extractSignalActions(instructionFor(phase));
      for (const a of mentioned) {
        expect(allowed.has(a)).toBe(true);
      }
    });
  }

  it("plan-modes are covered by the structured mapping (no derived instructions for plan-review)", () => {
    // Plan-review suppresses derived tool instructions in prompt-inject;
    // verify the structured mapping itself covers all three modes.
    expect(getAllowedActions("plan", "draft").signalActions).toContain("plan_draft_done");
    expect(getAllowedActions("plan", "revise").signalActions).toContain("plan_draft_done");
    expect(getAllowedActions("plan", "review").planReview).toBe(true);
  });

  it("no allowed action set contains the deprecated review_approve", () => {
    for (const { phase, planMode } of [...cases, { phase: "plan" as Phase, planMode: "draft" as PlanMode }, { phase: "plan" as Phase, planMode: "review" as PlanMode }, { phase: "plan" as Phase, planMode: "revise" as PlanMode }]) {
      expect(getAllowedActions(phase, planMode).signalActions).not.toContain("review_approve");
    }
  });
});
```

**Step 2 — Run test, verify it fails (or passes immediately)**

Before Task 1: the import fails with `Cannot find module '.../allowed-actions.js'`. Verified via `bun test tests/allowed-actions-parity.test.ts`.

After Task 1: the parity assertions should pass because `deriveToolInstructions` for `implement`/`verify`/`code-review`/`done` either does not mention specific `action: "..."` literals or mentions only `task_done`/`phase_next`, all of which are in the mapping. If `deriveToolInstructions` mentions an action not in the mapping, the test fails with a clear `expect(allowed.has("X")).toBe(true)` failure.

Run: `bun test tests/allowed-actions-parity.test.ts`
Expected: PASS (when Task 1 has landed).

**Step 3 — Write minimal implementation**

No implementation change is required if Task 1's mapping is correct. If a parity assertion fails, fix the mapping in `extensions/megapowers/workflows/allowed-actions.ts` to add the missing action (do NOT widen `deriveToolInstructions`; the mapping is the single source of truth per AC25 and the new compact header).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/allowed-actions-parity.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: Standardize handleSignal task_done feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC37. Updates `handleTaskDone` success messages to use `composeMessage` from `feedback.ts` so both the auto-advance-to-verify and next-task paths start with `✅`, name the completed task (index + description), state remaining-task count, and give an explicit next step.

**Step 1 — Write the failing test**

Append inside `describe("handleSignal", () => { ... describe("task_done — core behavior") })` in `tests/tool-signal.test.ts`:

```ts
    it("task_done success message starts with ✅ and names completed task index + description (AC36, AC37)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build it\n\n### Task 2: Polish\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const r = handleSignal(tmp, "task_done");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("Task 1");
      expect(r.message).toContain("Build it");
      // Remaining count + next task identifier (AC37)
      expect(r.message).toMatch(/1 task remaining/);
      expect(r.message).toContain("Task 2");
    });

    it("task_done message on final task names auto-advance to verify (AC37)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Only\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const r = handleSignal(tmp, "task_done");
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("Task 1");
      expect(r.message).toContain("Only");
      expect(r.message!.toLowerCase()).toContain("verify");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "task_done success message starts with"`
Expected: FAIL — `expect(r.message.startsWith("✅")).toBe(true)` — actual message is `Task 1 (Build it) marked complete. ...` (no leading icon).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`:

1. Add the import at the top of the file (next to the other imports):

```ts
import { composeMessage } from "../feedback.js";
```

2. In `handleTaskDone` (existing function at line 62), replace the two `return { message: ..., triggerNewSession: true }` blocks (lines 141–144 and 159–162) with `composeMessage` calls:

```ts
  if (allDone) {
    // Auto-advance to verify
    const updatedState = {
      ...state,
      completedTasks,
      tddTaskState: null,
    };
    const newState = transition(updatedState, "verify" as Phase);
    writeState(cwd, newState);
    return {
      message: composeMessage({
        icon: "success",
        summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
        changes: [`All ${tasks.length} tasks done`],
        nextStep: "Phase advanced to verify — begin verification.",
      }),
      triggerNewSession: true,
    };
  }

  // Advance to next task
  const nextIdx = nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex;
  const nextTask = tasks[nextIdx];
  const updatedState = {
    ...state,
    completedTasks,
    currentTaskIndex: nextIdx,
    tddTaskState: null,
  };
  writeState(cwd, updatedState);

  const remaining = tasks.length - completedTasks.length;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
      changes: [`${remaining} task${remaining === 1 ? "" : "s"} remaining`],
      nextStep: `Task ${nextTask.index}: ${nextTask.description}`,
    }),
    triggerNewSession: true,
  };
```

Pre-existing tests that assert `result.message).toContain("Task 2")`, `toContain("verify")`, and `toContain("complete")` still pass because the composed message preserves those substrings.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "task_done"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: Standardize handleSignal phase_next feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC38. Updates `handlePhaseNext` success message to start with `📋`, name the new phase, and give an explicit next-step phrase.

**Step 1 — Write the failing test**

Append inside `describe("phase_next", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("phase_next success message uses 📋 icon and names new phase + next-step phrase (AC36, AC38)", () => {
      setState(tmp, { phase: "brainstorm" });
      const r = handleSignal(tmp, "phase_next");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("📋")).toBe(true);
      expect(r.message).toContain("spec");
      expect(r.message).toMatch(/Next:/);
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "phase_next success message uses"`
Expected: FAIL — `expect(r.message.startsWith("📋")).toBe(true)`, actual message is `Phase advanced to spec. Proceed with spec phase work.` (no leading icon).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, in `handlePhaseNext` (line 239), replace the return block:

```ts
  return {
    message: composeMessage({
      icon: "info",
      summary: `Phase advanced to ${result.newPhase}`,
      nextStep: `Proceed with ${result.newPhase} phase work.`,
    }),
    triggerNewSession: true,
  };
```

(Assume the `composeMessage` import from Task 8 is already present; if Task 8 is applied first there is no second import to add.)

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "phase_next"`
Expected: PASS (existing `toContain("spec")` assertions continue to pass — the substring is preserved).

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 10: Standardize handleSignal phase_back feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC39. Updates `handlePhaseBack` success message to start with `⚠️`, name the new phase, and state "rework needed" / next-step phrase.

**Step 1 — Write the failing test**

Append inside `describe("phase_back", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("phase_back success message uses ⚠️ icon, names new phase, and includes rework / next-step phrase (AC36, AC39)", () => {
      setState(tmp, { phase: "verify" });
      const r = handleSignal(tmp, "phase_back");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("⚠️")).toBe(true);
      expect(r.message).toContain("implement");
      expect(r.message!.toLowerCase()).toContain("rework");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "phase_back success message uses"`
Expected: FAIL — `expect(r.message.startsWith("⚠️")).toBe(true)` — current message is `Phase moved back to implement. Rework needed — continue with the implement phase.` (no leading icon).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, in `handlePhaseBack` (line 254), replace the final return block (lines 293–296):

```ts
  return {
    message: composeMessage({
      icon: "warn",
      summary: `Phase moved back to ${result.newPhase}`,
      changes: ["Rework needed"],
      nextStep: `Continue with the ${result.newPhase} phase.`,
    }),
    triggerNewSession: true,
  };
```

Pre-existing tests asserting `toContain("implement")` continue to pass — the substring is preserved.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "phase_back"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Standardize tests_failed feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC40. `tests_failed` success message must start with a vocabulary icon (`✅`), state that RED is recorded, and state that production writes are now allowed.

**Step 1 — Write the failing test**

Append inside `describe("tests_failed", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("tests_failed success message starts with ✅ and states RED recorded + writes unlocked (AC36, AC40)", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const r = handleSignal(tmp, "tests_failed");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("RED");
      expect(r.message!.toLowerCase()).toContain("production");
      expect(r.message!.toLowerCase()).toMatch(/writes? .* allowed|allowed/);
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "tests_failed success message starts"`
Expected: FAIL — current message is `Tests failed (RED ✓). Production code writes are now allowed.` (already mentions RED and production writes, but does NOT start with `✅`). The `startsWith("✅")` assertion fails.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, replace the `handleTestsFailed` final return (line 186):

```ts
  return {
    message: composeMessage({
      icon: "success",
      summary: "Tests failed (RED ✓) — recorded",
      nextStep: "Production code writes are now allowed.",
    }),
  };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "tests_failed"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 12: Standardize tests_passed feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC41. `tests_passed` success message starts with `✅` and states GREEN recorded.

**Step 1 — Write the failing test**

Append inside `describe("tests_passed", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("tests_passed success message starts with ✅ and records GREEN (AC36, AC41)", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const r = handleSignal(tmp, "tests_passed");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("GREEN");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "tests_passed success message starts"`
Expected: FAIL — current message is `Tests passed (GREEN ✓).` which does not start with `✅`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, replace the `handleTestsPassed` return (line 200):

```ts
  return {
    message: composeMessage({
      icon: "success",
      summary: "Tests passed (GREEN ✓) — recorded",
    }),
  };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "tests_passed"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 13: Standardize plan_draft_done feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC42. `plan_draft_done` (handled by `handlePlanDraftDone` which delegates to `transitionDraftToReview`) success message must start with a vocabulary icon, name the count of tasks saved, and state the transition to review mode.

The current message (plan-orchestrator.ts:99–101) is `📝 Draft complete: N tasks saved\n  → Transitioning to review mode.` — it already covers task count and review transition. The remaining gap vs AC36 is that `📝` is not in the shared `ICONS` vocabulary from Task 2. Updating to use `composeMessage({ icon: "info", ... })` brings it into the vocabulary.

**Step 1 — Write the failing test**

Append inside `describe("plan_draft_done signal", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("plan_draft_done success message starts with a shared-vocabulary icon and names task count + review transition (AC36, AC42)", async () => {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");
      writeFileSync(join(tasksDir, "task-002.md"), "---\nid: 2\ntitle: T2\nstatus: draft\n---\nBody.");
      const r = await handlePlanDraftDone(tmp);
      expect(r.error).toBeUndefined();
      // Starts with one of the shared icons (📋 info)
      expect(r.message!.startsWith("📋")).toBe(true);
      expect(r.message).toContain("2 tasks");
      expect(r.message!.toLowerCase()).toContain("review mode");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "plan_draft_done success message starts"`
Expected: FAIL — current message starts with `📝`, not `📋`. The `startsWith("📋")` assertion fails.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/plan-orchestrator.ts`:

1. Add import at the top:

```ts
import { composeMessage } from "./feedback.js";
```

2. In `transitionDraftToReview` (line 80–104), replace the existing inline `message:` string (lines 99–101):

```ts
      message: composeMessage({
        icon: "info",
        summary: `Plan draft complete — ${taskCount} task${taskCount === 1 ? "" : "s"} saved`,
        nextStep: "Transitioning to review mode. A new review session will start.",
      }),
```

Pre-existing tests that assert `toContain("2 tasks")` and `toContain("review mode")` continue to pass.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "plan_draft_done"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 14: Standardize close_issue feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC43. `close_issue` success message starts with `✅`, names the closed issue slug, and includes the count of source issues closed when applicable.

**Step 1 — Write the failing test**

Append inside `describe("close_issue signal", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("close_issue success message starts with ✅ and names slug; includes source count when batch (AC36, AC43)", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "010-source-a.md"),
        "---\nid: 10\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Source A\nDesc",
      );
      writeFileSync(
        join(issuesDir, "020-batch.md"),
        "---\nid: 20\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\nsources: [10]\n---\n# Batch\nC",
      );
      setState(tmp, { activeIssue: "020-batch", phase: "done" });
      const r = handleSignal(tmp, "close_issue");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("020-batch");
      expect(r.message).toContain("1 source");
    });

    it("close_issue success message starts with ✅ when no sources (AC36, AC43)", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "001-test.md"),
        "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# T\nD",
      );
      setState(tmp, { phase: "done" });
      const r = handleSignal(tmp, "close_issue");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("001-test");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "close_issue success message starts"`
Expected: FAIL — current message is `Issue 020-batch marked as done (+ 1 source issues).` — `startsWith("✅")` fails.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, replace the final return in `handleCloseIssue` (line 321):

```ts
  const changes = sources.length > 0
    ? [`Closed ${sources.length} source issue${sources.length === 1 ? "" : "s"} (batch)`]
    : undefined;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Issue ${state.activeIssue} marked as done`,
      changes,
    }),
  };
```

Pre-existing tests asserting `toContain("done")` and `toContain("2 source issues")` continue to pass (substring `"2 source"` still appears via `"Closed 2 source issues"`).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "close_issue"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 15: Standardize plan_task create/update feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Modify: `tests/tool-plan-task.test.ts`

Covers AC44, AC45, AC46, AC50, AC51. Route `handlePlanTask` success messages through `composeMessage`, ensure the artifact path is present on both create and update, the explicit field list is in `changes`, and error messages identify the action and corrective step.

Currently create returns `✅ Task N saved: "title"\n  → path\n  Changed: ...\n  depends_on: ... | files: ...` and update returns `✅ Task N updated: "title"\n  → path\n  Changed: ...`. Both already include the icon and artifact path; this task makes both routes use the shared helper consistently and tightens errors to name the action name `plan_task` and a corrective action.

**Step 1 — Write the failing test**

Append inside `describe("handlePlanTask — create", ...)` in `tests/tool-plan-task.test.ts`:

```ts
  it("create error message identifies the action and names a corrective step (AC46)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, description: "A".repeat(200) });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan_task");
    expect(result.error!.toLowerCase()).toContain("provide title");
  });

  it("create success uses shared ✅ icon and lists fields set (AC44, AC50)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    expect(result.error).toBeUndefined();
    expect(result.message!.startsWith("✅")).toBe(true);
    expect(result.message).toContain(".megapowers/plans/001-test/tasks/task-001.md");
    // Explicit list of fields set
    expect(result.message).toContain("title");
    expect(result.message).toContain("files_to_modify");
  });
```

Append inside `describe("handlePlanTask — update (partial merge)", ...)`:

```ts
  it("update success uses shared ✅ icon and includes artifact path + changed list (AC45, AC50, AC51)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    const result = handlePlanTask(tmp, { id: 1, no_test: true });
    expect(result.message!.startsWith("✅")).toBe(true);
    expect(result.message).toContain(".megapowers/plans/001-test/tasks/task-001.md");
    expect(result.message).toContain("no_test");
  });

  it("update error message identifies plan_task and a corrective step (AC46)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    const result = handlePlanTask(tmp, { id: 1, files_to_modify: [], files_to_create: [] });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan_task");
    expect(result.error!.toLowerCase()).toContain("fix lint");
  });

  it("corrupt-existing error names plan_task and instructs to delete/recreate (AC46)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const taskDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, "task-001.md"), "---\nnot_a_field: bad\n---\nBody");
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan_task");
    expect(result.error!.toLowerCase()).toMatch(/delete .* recreate|recreate corrupt/);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: FAIL — at least:
- `expect(result.error).toContain("plan_task")` — current error message is `❌ Task 1 invalid: title is required when creating a new task.` (no `plan_task` action name).
- `toLowerCase()).toContain("provide title")` — current text says "title is required".

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-plan-task.ts`:

1. Add import at the top:

```ts
import { composeMessage } from "../feedback.js";
```

2. Replace the title/description missing errors (lines 42–48):

```ts
  if (!params.title) {
    return { error: `❌ plan_task: Task ${params.id} invalid — title is required. Provide title when creating a new task.` };
  }

  if (!params.description) {
    return { error: `❌ plan_task: Task ${params.id} invalid — description is required. Provide description when creating a new task.` };
  }
```

3. Replace the corrupt-existing error (line 35):

```ts
    return { error: `❌ plan_task: Task ${params.id} existing file is corrupt (${existing.error}). Delete and recreate the corrupt task file.` };
```

4. Replace the lint-failed errors (lines 64–66 and 128–130):

```ts
    return {
      error: `❌ plan_task: Task ${params.id} lint failed — fix lint errors:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
```

5. Replace the Zod validation error (line 72):

```ts
    return { error: `❌ plan_task: Task ${params.id} invalid — ${issues}. Fix the listed validation errors.` };
```

6. Replace the create-success return (lines 80–86) with:

```ts
  const fields = ["title", "description", "depends_on", "no_test", "files_to_modify", "files_to_create"];
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${task.id} saved: "${task.title}"`,
      changes: [`Fields set: ${fields.join(", ")}`, `depends_on: [${depsStr}] | files: ${filesCount}`],
      artifactPath: taskPath,
    }),
  };
```

7. Replace the update-success return (lines 135–140) with:

```ts
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${merged.id} updated: "${merged.title}"`,
      changes: [`Changed: ${changed.length > 0 ? changed.join(", ") : "no changes"}`],
      artifactPath: taskPath,
    }),
  };
```

Pre-existing tests asserting `toContain("Task 1")`, `toContain('"T"')`, `toContain("task-001.md")`, `toContain("Changed:")`, `toContain("files_to_modify")`, and `toContain("Task 1 lint failed")` still pass — the substrings remain in the composed message (lint error keeps capital `Task`).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 16: Standardize plan_review approve/revise feedback [depends: 2]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Modify: `tests/tool-plan-review.test.ts`

Covers AC47, AC48, AC49, AC50, AC51. Route `transitionReviewToRevise` messages through `composeMessage` and have `handleApproveVerdict` compose the approve message at the tool layer so the slug-aware `plan.md` artifact path is included. Error messages identify `plan_review` and a corrective action.

**Step 1 — Write the failing test**

Append to `tests/tool-plan-review.test.ts`:

```ts
describe("handlePlanReview — message shape", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-shape-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("revise message includes iteration, approved IDs, needs-revision IDs, and transition next-step (AC47)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "instructions");

    const r = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "fix it",
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });
    expect(r.error).toBeUndefined();
    expect(r.message).toContain("iteration 2");
    expect(r.message).toContain("1"); // approved id
    expect(r.message).toContain("2"); // revise id
    expect(r.message!.toLowerCase()).toContain("revise mode");
  });

  it("approve message includes iteration, count of approved tasks, plan.md artifact path, and implement next-step (AC48, AC51)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 2 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    const r = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "all good",
      approved_tasks: [1, 2],
    });
    expect(r.error).toBeUndefined();
    expect(r.message).toContain("iteration 2");
    expect(r.message).toContain("2"); // approved count
    expect(r.message).toContain(".megapowers/plans/001-test/plan.md");
    expect(r.message!.toLowerCase()).toContain("implement");
  });

  it("revise verdict at iteration cap returns error naming plan_review and corrective action (AC49)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 4 });
    createTaskFile(tmp, 1, "T1");
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-4.md"), "instr");
    const r = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "x",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(r.error).toBeDefined();
    expect(r.error).toContain("plan_review");
  });

  it("missing revise-instructions error names plan_review and tells the user to write the file (AC49)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    const r = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "x",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(r.error).toBeDefined();
    expect(r.error).toContain("plan_review");
    expect(r.error!.toLowerCase()).toMatch(/write .* revise-instructions/);
  });

  it("wrong-phase error names plan_review (AC49)", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const r = handlePlanReview(tmp, { verdict: "approve", feedback: "x" });
    expect(r.error).toBeDefined();
    expect(r.error).toContain("plan_review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review.test.ts -t "message shape"`
Expected: FAIL — at minimum:
- `expect(r.message).toContain(".megapowers/plans/001-test/plan.md")` — current approve message lacks the relative path.
- `expect(r.error).toContain("plan_review")` for the iteration-cap and missing-revise-instructions errors — neither current error string contains the `plan_review` token. (The wrong-phase case happens to pass already because `megapowers_plan_review` contains the substring.)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/plan-orchestrator.ts`:

1. Add at the top (if not present from Task 13): `import { composeMessage } from "./feedback.js";`

2. In `transitionReviewToRevise`, replace the iteration-cap error (lines 122–125):

```ts
      error: composeMessage({
        icon: "warn",
        summary: `plan_review: reached ${maxIterations} iterations without approval — Human intervention needed`,
        nextStep: "Use /mega off to disable enforcement and manually advance, or revise the spec.",
      }),
```

3. In `transitionReviewToRevise`, replace the revise success-message (lines 137–140):

```ts
      message: composeMessage({
        icon: "info",
        summary: `Plan review: REVISE (iteration ${state.planIteration + 1} of ${maxIterations})`,
        changes: [
          `Tasks ${approvedIds.join(", ") || "none"} approved`,
          `Tasks ${needsRevisionIds.join(", ") || "none"} need revision`,
        ],
        nextStep: "Transitioning to revise mode. A new review session will start.",
      }),
```

Do not change `approvePlan`'s shape or return type — the tool layer overrides its `message`.

In `extensions/megapowers/tools/tool-plan-review.ts`:

1. Add at the top: `import { composeMessage } from "../feedback.js";`

2. Update wrong-phase / wrong-planMode errors (lines 26–32):

```ts
  if (state.phase !== "plan") {
    return { error: "❌ plan_review: not in plan phase. Submit during plan review." };
  }

  if (state.planMode !== "review") {
    return { error: `❌ plan_review: not in review mode (got planMode '${state.planMode}'). Submit during plan review.` };
  }
```

3. Update missing-revise-instructions error (lines 41–47):

```ts
      return {
        error: composeMessage({
          icon: "error",
          summary: `plan_review: missing revise-instructions file at ${filepath}`,
          nextStep: `Write ${filename} before submitting a revise verdict.`,
        }),
      };
```

4. In `handleApproveVerdict` (line 95), replace the final return (lines 119–122) with a composed message that includes the slug-specific artifact path:

```ts
  updateTaskStatuses(
    cwd,
    slug,
    orchestrated.value.statusUpdates.map((update) => update.taskId),
    "approved",
  );
  const planDir = join(cwd, ".megapowers", "plans", slug);
  writeFileSync(join(planDir, "plan.md"), orchestrated.value.legacyPlanMd);
  writeState(cwd, orchestrated.value.nextState);
  return {
    message: composeMessage({
      icon: "success",
      summary: `Plan approved (iteration ${state.planIteration})`,
      changes: [`All ${tasks.length} tasks approved`],
      artifactPath: `.megapowers/plans/${slug}/plan.md`,
      nextStep: "Advancing to implement phase.",
    }),
    triggerNewSession: true,
  };
```

The existing test `it("returns success message with task count", ...)` asserts `toContain("approved")`, `toContain("2")`, and `toContain("implement")` — all three substrings remain in the composed message.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 17: Add operation-feedback documentation [no-test] [depends: 2, 8, 13, 15, 16]

**Justification:** Documentation-only — AC53 explicitly requires a short `docs/` page describing the shared status vocabulary and the result-message shape. No observable behavior changes; verification is via the file existing with the required sections and the test suite continuing to pass.

**Files:**
- Create: `docs/operation-feedback.md`

**Step 1 — Make the change**

Write `docs/operation-feedback.md`:

```md
# Megapowers Operation Feedback

This page documents the shared status vocabulary and result-message shape used by Megapowers tool handlers — `handleSignal`, `handlePlanTask`, `handlePlanReview`, `handlePlanDraftDone`, and `handleCloseIssue` — and the convention new megapowers tools should adopt.

## Status vocabulary

Defined in `extensions/megapowers/feedback.ts` as `ICONS`:

| Key       | Icon | When to use                                                |
|-----------|------|------------------------------------------------------------|
| `success` | ✅   | An action completed successfully.                          |
| `info`    | 📋   | An informational / coordination event (e.g. phase advance).|
| `warn`    | ⚠️   | Something happened that needs attention but is not an error (e.g. rework, iteration cap). |
| `error`   | ❌   | An action failed.                                          |
| `note`    | 📝   | A neutral status note (e.g. draft saved).                  |

The deprecated `review_approve` action is not part of this vocabulary and is never advertised by any tool.

## Result-message shape

Compose result messages via `composeMessage({ icon, summary, changes?, artifactPath?, nextStep? })`. Output shape:

```
<ICON> <summary>
  • <change-1>
  • <change-2>
  → <artifactPath>
  Next: <nextStep>
```

- `summary` — single-line "what changed" phrase.
- `changes` — optional list of specific fields / counts that changed.
- `artifactPath` — relative path under `.megapowers/plans/<slug>/` when an artifact was written or updated.
- `nextStep` — explicit next action for the agent / user.

## Tool conventions

| Tool                         | Icon on success | Required content                                       |
|------------------------------|-----------------|--------------------------------------------------------|
| `task_done`                  | ✅              | Completed task id+description, remaining count, next task or auto-advance phrase. |
| `phase_next`                 | 📋              | New phase name + explicit next-step.                   |
| `phase_back`                 | ⚠️              | New phase name + rework / next-step phrase.            |
| `tests_failed`               | ✅              | RED recorded + production writes now allowed.          |
| `tests_passed`               | ✅              | GREEN recorded.                                        |
| `plan_draft_done`            | 📋              | Task count + transition to review mode.                |
| `close_issue`                | ✅              | Closed slug + source-issues-closed count when applicable. |
| `plan_task` (create/update)  | ✅              | Task id+title, artifact path, fields set / changed.    |
| `plan_review` (approve)      | ✅              | Iteration, approved count, generated `plan.md` path, advance to implement. |
| `plan_review` (revise)       | 📋              | Iteration, approved IDs, needs-revision IDs, transition to revise mode. |

## Errors

Error messages must:
- Begin with `❌`.
- Name the failing action (e.g. `plan_task`, `plan_review`).
- Name the corrective action (e.g. `provide title`, `fix lint errors`, `submit during plan review`, `write revise-instructions file before revise verdict`, `delete and recreate corrupt task`).

## Adding new megapowers tools

New tools must:
1. Import `composeMessage` and `ICONS` from `extensions/megapowers/feedback.ts`.
2. Return `{ message }` / `{ error }` composed via `composeMessage`.
3. Include the saved artifact path whenever a file under `.megapowers/plans/<slug>/` is written or updated.
4. Make the next-step explicit.
5. Never advertise the deprecated `review_approve` action.
```

**Step 2 — Verify**
Run: `bun test` and confirm the suite is still green, and verify the file exists.
Run: `cat docs/operation-feedback.md | head -5`
Expected: file starts with `# Megapowers Operation Feedback`.
Run: `bun test` → all passing.
