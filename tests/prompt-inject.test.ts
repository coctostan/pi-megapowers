import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

describe("buildInjectedPrompt", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null when megaEnabled is false", () => {
    setState(tmp, { phase: "spec", megaEnabled: false });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  it("returns non-null idle content when no active issue and mega enabled", () => {
    writeState(tmp, createInitialState());
    expect(buildInjectedPrompt(tmp)).not.toBeNull();
  });

  it("includes megapowers protocol section with tool descriptions", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_signal");
    expect(result).toContain("Artifact Persistence");
  });

  it("includes phase-specific tool instructions for spec phase (AC19)", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("write");
    expect(result).toContain(".megapowers/plans/001-test/spec.md");
  });

  it("includes phase-specific tool instructions for implement phase (AC42)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    const dir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build it\n\n### Task 2: Test it\n");
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("Task 1");
    expect(result).toContain("task_done");
  });


  it("includes phase_next instructions for brainstorm phase (AC42)", () => {
    setState(tmp, { phase: "brainstorm", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("phase_next");
  });
});

describe("buildInjectedPrompt — plan mode routing", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-plan-mode-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("loads write-plan.md when planMode is draft", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("You are writing a step-by-step implementation plan");
  });

  it("loads review-plan.md when planMode is review", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("You are reviewing an implementation plan before it goes to implementation.");
    expect(result).not.toContain("You are writing a step-by-step implementation plan");
  });

  it("does not load write-plan.md when planMode is revise", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).not.toContain("You are writing a step-by-step implementation plan");
  });
});

describe("done phase — doneActions prompt injection (AC16, AC17)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-done-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("injects done template listing selected actions when doneActions is non-empty", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["generate-docs", "write-changelog", "capture-learnings", "close-issue"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("generate-docs");
    expect(result).toContain("write-changelog");
    expect(result).toContain("capture-learnings");
    expect(result).toContain("close-issue");
  });

  it("injects done template with single action", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["write-changelog"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("write-changelog");
  });

  it("no action prompt when doneActions is empty", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: [],
    });
    const result = buildInjectedPrompt(tmp);
    // Should still get protocol prompt but not the done actions template
    expect(result).not.toBeNull();
    expect(result).not.toContain("Execute the following wrap-up actions");
  });

  it("lists all selected actions in doneActions list", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["generate-docs", "capture-learnings"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("generate-docs");
    expect(result).toContain("capture-learnings");
  });

  it("instructs capture-learnings to write .megapowers/plans/001-test/learnings.md (AC17)", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["capture-learnings"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("learnings");
    expect(result).toContain(".megapowers/plans/001-test/learnings.md");
  });

  it("instructs close-issue with explicit steps (AC17)", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["close-issue"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("close-issue");
    expect(result!.length).toBeGreaterThan(200);
  });
});

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

  it("includes protocol section with tool names (AC3)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("Megapowers Protocol");
    expect(result).toContain("megapowers_signal");
    expect(result).toContain("Artifact Persistence");
  });

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

  it("renders missing priority as none in idle prompt", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);
    store.createIssue("Auth refactor", "feature", "Refactor auth module");

    const result = buildInjectedPrompt(tmp, store);
    expect(result).toContain("priority: none");
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

  it("includes slash command hints (AC5)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("/issue new");
    expect(result).toContain("/issue list");
    expect(result).toContain("/triage");
    expect(result).toContain("/mega on|off");
  });

  it("includes roadmap and milestones reference (AC6)", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("ROADMAP.md");
    expect(result).toContain(".megapowers/milestones.md");
  });
});


describe("prompt-inject.ts refactor verification", () => {
  it("uses workflow config for artifact loading (no hardcoded artifactMap)", () => {
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "prompt-inject.ts"),
      "utf-8",
    );
    expect(source).toContain("getWorkflowConfig");
    expect(source).not.toContain("artifactMap");
    expect(source).not.toContain("PHASE_TOOL_INSTRUCTIONS");
  });
});

describe("derived.ts refactor verification", () => {
  it("uses workflow config for acceptance criteria (no hardcoded bugfix check)", () => {
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "state", "derived.ts"),
      "utf-8",
    );
    expect(source).toContain("getWorkflowConfig");
    expect(source).not.toContain('=== "bugfix"');
  });
});

it("buildInjectedPrompt signature no longer includes _jj", () => {
  const source = readFileSync(
    join(process.cwd(), "extensions", "megapowers", "prompt-inject.ts"),
    "utf-8",
  );
  expect(source).not.toContain("_jj?:");
  expect(source).toContain("export function buildInjectedPrompt(cwd: string, store?: Store)");
});
