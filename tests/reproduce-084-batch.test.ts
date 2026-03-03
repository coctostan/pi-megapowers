/**
 * Reproduction tests for batch issue #084
 * Covers: #081 (close-issue in prompt-driven path), #082 (revise-instructions handoff), #083 (code-review gate)
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { onAgentEnd } from "../extensions/megapowers/hooks.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { advancePhase } from "../extensions/megapowers/policy/phase-advance.js";
import { showDoneChecklist } from "../extensions/megapowers/ui.js";

// --- helpers ---

function setState(cwd: string, overrides: Partial<MegapowersState>) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  });
}

function setupIssue(cwd: string, slug = "001-test") {
  const issuesDir = join(cwd, ".megapowers", "issues");
  mkdirSync(issuesDir, { recursive: true });
  writeFileSync(
    join(issuesDir, `${slug}.md`),
    `---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2025-01-01T00:00:00Z\n---\n# Test Issue\nDescription`,
  );
}

function makeStore(cwd: string) {
  return {
    writeFeatureDoc: () => {},
    appendChangelog: () => {},
    getIssue: () => ({ title: "Test", description: "test", sources: [] }),
    getSourceIssues: () => [],
    updateIssueStatus: () => {},
  };
}

function makeCtx(cwd: string, hasUI: boolean) {
  return {
    hasUI,
    cwd,
    ui: { notify: () => {} },
  };
}

function makeDeps(cwd: string) {
  return {
    store: makeStore(cwd),
    ui: { renderDashboard: () => {} },
  };
}

function makeAgentEndEvent(text: string) {
  return {
    messages: [
      { role: "assistant", content: [{ type: "text", text }] },
    ],
  };
}

// =============================================================================
// Issue #081: close-issue wrap-up action not executed in prompt-driven done phase
// =============================================================================

describe("#081 — close-issue not executed when no TUI (prompt-driven path)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "reproduce-081-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("BUG: showDoneChecklist is a no-op when ctx.hasUI is false, leaving doneActions empty", async () => {
    setState(tmp, { phase: "done", doneActions: [] });

    // Simulate headless context (no TUI)
    const ctx = makeCtx(tmp, /* hasUI */ false);
    await showDoneChecklist(ctx, tmp);

    // doneActions should still be empty — showDoneChecklist did nothing
    const state = readState(tmp);
    expect(state.doneActions).toEqual([]);
    // This means close-issue can never execute in headless mode
  });

  it("BUG: onAgentEnd skips close-issue when doneActions is empty (the consequence)", async () => {
    // When doneActions is empty, onAgentEnd does NOT process close-issue
    setupIssue(tmp);
    setState(tmp, { phase: "done", doneActions: [] });

    const statusUpdates: { slug: string; status: string }[] = [];
    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: (slug: string, status: string) => {
          statusUpdates.push({ slug, status });
        },
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("done"), makeCtx(tmp, false), deps as any);

    // No issue status update — close-issue was never executed
    expect(statusUpdates).toEqual([]);
    // State was NOT reset — activeIssue still set
    const state = readState(tmp);
    expect(state.activeIssue).toBe("001-test");
    expect(state.phase).toBe("done");
  });

  it("BUG: buildInjectedPrompt returns NO done template when doneActions is empty", () => {
    setState(tmp, { phase: "done", doneActions: [], megaEnabled: true });
    const prompt = buildInjectedPrompt(tmp);
    // The done template (done.md) is NOT injected when doneActions is empty
    // The prompt should contain done-phase guidance but does NOT
    // "You are executing wrap-up actions" is the unique done.md header
    expect(prompt).not.toContain("You are executing wrap-up actions");
    expect(prompt).not.toContain("Selected Wrap-up Actions");
    expect(prompt).not.toContain("done_actions_list");
  });

  it("CONTROL: onAgentEnd DOES close issue when doneActions contains close-issue", async () => {
    // The TUI path works correctly
    setupIssue(tmp);
    setState(tmp, { phase: "done", doneActions: ["close-issue"] });

    const statusUpdates: { slug: string; status: string }[] = [];
    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: (slug: string, status: string) => {
          statusUpdates.push({ slug, status });
        },
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(
      makeAgentEndEvent("done"),
      { ...makeCtx(tmp, true), ui: { notify: () => {} } },
      deps as any,
    );

    // close-issue WAS executed — issue status updated
    expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
    // State was reset
    const state = readState(tmp);
    expect(state.activeIssue).toBeNull();
  });

  it("CONTROL: buildInjectedPrompt injects done template when doneActions is populated", () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["generate-docs", "close-issue"],
      megaEnabled: true,
    });

    const prompt = buildInjectedPrompt(tmp);

    // With doneActions populated, done.md template IS injected
    expect(prompt).toContain("wrap-up actions");
    expect(prompt).toContain("generate-docs");
    expect(prompt).toContain("close-issue");
  });
});

// =============================================================================
// Issue #082: Reviewer-authored revise-instructions handoff
// =============================================================================

describe("#082 — revise-instructions handoff wired up", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "reproduce-082-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("FIX: revise-plan.md contains {{revise_instructions}} in Reviewer's Instructions section (AC8)", () => {
    const template = readFileSync(join(process.cwd(), "prompts/revise-plan.md"), "utf-8");
    // Fix applied: {{revise_instructions}} is now in the template for auto-injection
    expect(template).toContain("{{revise_instructions}}");
  });

  it("FIX: review-plan.md instructs reviewer to write revise-instructions file with {{plan_iteration}} (AC9)", () => {
    const template = readFileSync(join(process.cwd(), "prompts/review-plan.md"), "utf-8");
    // Fix applied: template now instructs writing revise-instructions-{{plan_iteration}}.md
    expect(template).toContain("revise-instructions-{{plan_iteration}}.md");
  });

  it("FIX: buildInjectedPrompt injects revise-instructions content in revise mode (AC1)", () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "task-001.md"),
      "---\nid: 1\ntitle: Test\nstatus: needs_revision\n---\n# Test task",
    );

    // Write a revise-instructions file for iteration 1 (planIteration=2 → looks for revise-instructions-1.md)
    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "revise-instructions-1.md"),
      "## Revision Instructions\n\nFix task 1: add specific error message in step 2.",
    );
    setState(tmp, {
      phase: "plan",
      planMode: "revise",
      planIteration: 2,  // planIteration - 1 = 1 → reads revise-instructions-1.md
      megaEnabled: true,
    });
    const store = createStore(tmp);
    const prompt = buildInjectedPrompt(tmp, store);
    // Fix applied: revise-instructions content IS now auto-injected
    expect(prompt).toContain("Revision Instructions");
    expect(prompt).toContain("Fix task 1");
  });

  it("FIX: tool-plan-review validates revise-instructions file exists before accepting revise verdict (AC5, AC6)", () => {
    // Fix applied: the tool now requires the reviewer to create a revise-instructions file.
    // Verified by reading the tool source:
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/tools/tool-plan-review.ts"),
      "utf-8",
    );
    expect(source).toContain("revise-instructions");
    expect(source).toContain("existsSync");
  });
});

// =============================================================================
// Issue #083: Code-review report not visible before done-phase checklist fires
// =============================================================================

describe("#083 — code-review artifact gate and done-checklist timing", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "reproduce-083-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    setupIssue(tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("FINDING: feature workflow HAS requireArtifact gate for code-review.md → done", () => {
    // The issue claims there's no gate — but there IS one in the feature workflow config
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/workflows/feature.ts"),
      "utf-8",
    );
    // Verify the gate exists
    expect(source).toContain('from: "code-review", to: "done"');
    expect(source).toContain('requireArtifact');
    expect(source).toContain('code-review.md');
  });

  it("FINDING: advancePhase blocks code-review → done when code-review.md missing", () => {
    setState(tmp, { phase: "code-review" });

    // Try to advance without writing code-review.md
    const result = advancePhase(tmp);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("code-review.md not found");
  });

  it("FINDING: advancePhase allows code-review → done when code-review.md exists", () => {
    setState(tmp, { phase: "code-review" });

    // Write code-review.md
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "code-review.md"), "# Code Review\n\nAll good.");

    const result = advancePhase(tmp);

    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("done");
  });

  it("UX-ISSUE: showDoneChecklist fires synchronously inside tool execute (timing concern)", () => {
    // The showDoneChecklist is called INSIDE the megapowers_signal tool's execute()
    // function (register-tools.ts:49-54). While the gate prevents advancing without
    // code-review.md, the user still gets the checklist immediately after the LLM writes
    // the review and calls phase_next — no time to actually read the review findings.
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/register-tools.ts"),
      "utf-8",
    );

    // Verify showDoneChecklist IS called inside the tool handler for megapowers_signal
    // Use the full file since the signal tool block contains it
    expect(source).toContain("showDoneChecklist");

    // The call is inside the execute() of megapowers_signal, triggered by phase_next → done
    // Verify the sequence: check phase_next action, read state, check done phase, show checklist
    const checklistCallIdx = source.indexOf("await showDoneChecklist");
    const phaseNextCheckIdx = source.indexOf('params.action === "phase_next"');
    const doneCheckIdx = source.indexOf('currentState.phase === "done"');
    // All three appear and in the correct order
    expect(phaseNextCheckIdx).toBeGreaterThan(-1);
    expect(doneCheckIdx).toBeGreaterThan(phaseNextCheckIdx);
    expect(checklistCallIdx).toBeGreaterThan(doneCheckIdx);
  });

  it("FINDING: bugfix workflow does NOT have code-review phase (not affected by #083)", () => {
    setState(tmp, { phase: "verify", workflow: "bugfix" });

    // Bugfix goes verify → done directly, no code-review
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });

    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("done");
  });
});
