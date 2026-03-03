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

  it("FIX: showDoneChecklist auto-populates defaults when ctx.hasUI is false (#081)", async () => {
    setState(tmp, { phase: "done", doneActions: [] });
    const ctx = makeCtx(tmp, /* hasUI */ false);
    await showDoneChecklist(ctx, tmp);
    const state = readState(tmp);
    // After fix: doneActions should contain all default-checked items
    expect(state.doneActions).toContain("generate-docs");
    expect(state.doneActions).toContain("write-changelog");
    expect(state.doneActions).toContain("capture-learnings");
    expect(state.doneActions).toContain("push-and-pr");
    expect(state.doneActions).toContain("close-issue");
  });

  it("FIX: onAgentEnd invokes showDoneChecklist and populates doneActions when empty (#081)", async () => {
    setupIssue(tmp);
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });
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
    // First call: deferred checklist populates doneActions (headless auto-defaults)
    await onAgentEnd(makeAgentEndEvent("done"), makeCtx(tmp, false), deps as any);
    const state = readState(tmp);
    // doneActions should now be populated via auto-defaults
    expect(state.doneActions.length).toBeGreaterThan(0);
    expect(state.doneChecklistShown).toBe(true);
  });

  it("FIX: buildInjectedPrompt injects done template when doneActions is populated after headless auto-fill (#081)", () => {
    // After the headless fix, doneActions will be populated, so done.md template IS injected
    setState(tmp, {
      phase: "done",
      doneActions: ["generate-docs", "write-changelog", "capture-learnings", "push-and-pr", "close-issue"],
      megaEnabled: true,
    });
    const prompt = buildInjectedPrompt(tmp);
    expect(prompt).toContain("wrap-up actions");
    expect(prompt).toContain("close-issue");
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

  it("FIX: showDoneChecklist is NOT called inside megapowers_signal execute (#083)", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/register-tools.ts"),
      "utf-8",
    );

    // After fix: showDoneChecklist should NOT appear in register-tools.ts at all
    expect(source).not.toContain("showDoneChecklist");
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
