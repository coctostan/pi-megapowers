import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt, renderFullProtocolPrompt } from "../extensions/megapowers/prompt-inject.js";
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

  it("includes compact megapowers header for active issues", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("## Megapowers");
    expect(result).not.toContain("## Megapowers Protocol");
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

  it("does not inject the primary review prompt into advisory subagent sessions", () => {
    const originalDepth = process.env.PI_SUBAGENT_DEPTH;
    process.env.PI_SUBAGENT_DEPTH = "1";

    try {
      setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
      const result = buildInjectedPrompt(tmp);
      expect(result).not.toBeNull();
      expect(result).not.toContain("You are reviewing an implementation plan before it goes to implementation.");
      expect(result).toContain("This is an advisory subagent session for plan review.");
      expect(result).not.toContain("megapowers_plan_review({");
    } finally {
      if (originalDepth === undefined) {
        delete process.env.PI_SUBAGENT_DEPTH;
      } else {
        process.env.PI_SUBAGENT_DEPTH = originalDepth;
      }
    }
  });

  it("review mode routes approval through megapowers_plan_review instead of phase_next", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_plan_review");
    expect(result).not.toContain('Then call `megapowers_signal` with action `"phase_next"` to advance.');
    expect(result).not.toContain('writing it to `.megapowers/plans/001-test/plan.md`');
  });

  it("review-plan prompt keeps reviewer ownership even after deterministic checks", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });

    const result = buildInjectedPrompt(tmp);

    expect(result).not.toBeNull();
    expect(result).toContain("Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval.");
    expect(result).toContain("You still own the full review verdict.");
    expect(result).toContain("Review each task in order: coverage, dependencies, TDD correctness, then self-containment/codebase realism.");
    expect(result).not.toContain("The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1).");
    expect(result).not.toContain("Focus your review entirely on higher-order concerns");
  });

  it("does not load write-plan.md when planMode is revise", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).not.toContain("You are writing a step-by-step implementation plan");
  });
});

describe("buildInjectedPrompt — plan phase variable injection", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-plan-vars-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("populates plan_iteration as string when phase is plan (AC4)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 3, megaEnabled: true });
    const store = createStore(tmp);
    // review-plan.md has {{plan_iteration}} after Task 2
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    // The template variable {{plan_iteration}} should be replaced with "3"
    expect(result).toContain("revise-instructions-3.md");
    // Verify it doesn't contain the un-interpolated template variable
    expect(result).not.toContain("{{plan_iteration}}");
  });

  it("populates revise_instructions from file when planMode is revise (AC1)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const store = createStore(tmp);
    // planIteration - 1 = 1; reviewer at iteration 1 wrote revise-instructions-1.md
    store.writePlanFile("001-test", "revise-instructions-1.md", "## Task 3: Fix test\n\nStep 2 needs specific error message.");
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(result).toContain("## Task 3: Fix test");
    expect(result).toContain("Step 2 needs specific error message.");
    expect(result).not.toContain("{{revise_instructions}}");
  });

  it("sets revise_instructions to empty string when file is missing in revise mode (AC2)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const store = createStore(tmp);
    // No revise-instructions-1.md written — file is missing
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    // Token must be replaced (not left as literal template variable)
    expect(result).not.toContain("{{revise_instructions}}");
    // Both surrounding headings should still be present
    expect(result).toContain("## Reviewer's Instructions");
    expect(result).toContain("## Quality Bar");
  });

  it("does not read revise-instructions-* files when planMode is draft (AC3)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const store = createStore(tmp);

    const calls: string[] = [];
    const originalReadPlanFile = store.readPlanFile.bind(store);
    (store as any).readPlanFile = (slug: string, filename: string) => {
      calls.push(filename);
      return originalReadPlanFile(slug, filename);
    };

    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(calls.some(f => f.startsWith("revise-instructions-"))).toBe(false);
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

  it("includes branch_name and base_branch in done phase prompt when set", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["push-and-pr", "close-issue"],
      branchName: "feat/091-test-branch",
      baseBranch: "main",
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("feat/091-test-branch");
    expect(result).toContain("main");
  });

  it("does not leave raw branch template vars when branch/base are null", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["close-issue"],
      branchName: null,
      baseBranch: null,
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).not.toContain("{{branch_name}}");
    expect(result).not.toContain("{{base_branch}}");
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

  it("includes compact megapowers header in idle prompt", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("## Megapowers");
    expect(result).not.toContain("## Megapowers Protocol");
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

  it("includes issue-selection slash command hints", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("/issue new");
    expect(result).toContain("/issue list");
    expect(result).toContain("/triage");
    expect(result).not.toContain("Commands:");
    expect(result).not.toContain("/mega on|off");
  });

  it("idle prompt is non-empty and mentions issue selection actions", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp)!;
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("/issue list");
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


describe("buildInjectedPrompt — focused review artifacts", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-focused-review-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function createTaskFiles(count: number) {
    const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= count; i++) {
      writeFileSync(
        join(dir, `task-${String(i).padStart(3, "0")}.md`),
        `---\nid: ${i}\ntitle: Task ${i}\nstatus: draft\nfiles_to_modify:\n  - tests/fake-${i}.ts\nfiles_to_create: []\n---\nTask body ${i}.`,
      );
    }
  }

  it("keeps existing review behavior when focused review fan-out is not triggered", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    createTaskFiles(4);

    const result = buildInjectedPrompt(tmp);

    expect(result).not.toContain("Focused Review Advisory Artifacts");
    expect(result).not.toContain("coverage-review.md");
    expect(result).not.toContain("dependency-review.md");
    expect(result).not.toContain("task-quality-review.md");
  });

  it("includes all available focused review artifacts before the final review verdict is generated", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    createTaskFiles(5);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "coverage-review.md"), "## Coverage Summary\n- Overall: covered");
    writeFileSync(join(planDir, "dependency-review.md"), "## Dependency Summary\n- Overall ordering: sound");
    writeFileSync(join(planDir, "task-quality-review.md"), "## Task Quality Summary\n- Overall: strong");

    const result = buildInjectedPrompt(tmp);

    expect(result).toContain("## Focused Review Advisory Artifacts");
    expect(result).toContain("## Coverage Summary");
    expect(result).toContain("## Dependency Summary");
    expect(result).toContain("## Task Quality Summary");
    expect(result).toContain("The main plan-review session still owns the final approve/revise decision and the only allowed `megapowers_plan_review` call.");
  });

  it("names missing artifacts when fan-out partially fails and emits a full failure note when none are available", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    createTaskFiles(5);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "coverage-review.md"), "## Coverage Summary\n- Overall: partial");

    const partial = buildInjectedPrompt(tmp);
    expect(partial).toContain("Unavailable focused review artifacts: dependency-review.md, task-quality-review.md");

    // Remove only the artifact files, leave tasks directory intact so taskCount stays at 5
    rmSync(join(planDir, "coverage-review.md"), { force: true });
    const none = buildInjectedPrompt(tmp);
    expect(none).toContain("Focused review fan-out failed and the review proceeded without advisory artifacts.");
  });
});


describe("buildInjectedPrompt — inline phase tool guidance", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-phase-tools-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("injects representative inline hints for feature phases", () => {
    setState(tmp, { phase: "brainstorm", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents.");

    setState(tmp, { phase: "spec", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality.");

    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single script rather than issuing many sequential tool calls.");

    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task.");

    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.");

    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    expect(buildInjectedPrompt(tmp)).toContain("Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.");

    setState(tmp, { phase: "verify", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran.");

    setState(tmp, { phase: "code-review", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input.");
  });

  it("injects representative inline hints for bugfix and done prompts", () => {
    setState(tmp, { workflow: "bugfix", phase: "reproduce", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When the error mentions a specific symbol or file, use `symbol_graph` with `include: [\"source\"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report.");

    setState(tmp, { workflow: "bugfix", phase: "diagnose", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph.");

    setState(tmp, { phase: "done", megaEnabled: true, doneActions: ["generate-docs"] });
    expect(buildInjectedPrompt(tmp)).toContain("When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: \"<name>\"`) to pull the real signature into the doc. Do not paraphrase signatures from memory.");
  });
});

describe("renderFullProtocolPrompt", () => {
  it("returns the canonical `## Megapowers Protocol` content (AC33, AC35)", () => {
    const out = renderFullProtocolPrompt();
    expect(out).toContain("## Megapowers Protocol");
    expect(out).toContain("megapowers_signal");
    expect(out).toContain("megapowers_plan_task");
    expect(out).toContain("megapowers_plan_review");
  });
});

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