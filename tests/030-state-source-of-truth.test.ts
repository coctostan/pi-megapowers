import { describe, it, expect } from "bun:test";
import { hasOpenQuestions, extractAcceptanceCriteria } from "../extensions/megapowers/spec-parser.js";
import { processAgentOutput } from "../extensions/megapowers/artifact-router.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  };
}

// =============================================================================
// Bug Cluster 1: Parser detection failures (#023, #024, #006, #028)
// =============================================================================

describe("#023 — hasOpenQuestions treats 'None' as an open question", () => {
  const sentinels = ["None", "None.", "N/A", "n/a", "No open questions", "No open questions.", "(none)", "(None)"];

  for (const sentinel of sentinels) {
    it(`returns false when Open Questions contains "${sentinel}"`, () => {
      const spec = `## Acceptance Criteria\n1. It works\n\n## Open Questions\n${sentinel}\n`;
      expect(hasOpenQuestions(spec)).toBe(false);
    });
  }

  it("still returns true for actual questions", () => {
    const spec = `## Open Questions\n- What about edge case X?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("still returns true for numbered questions", () => {
    const spec = `## Open Questions\n1. How should we handle auth?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });
});

describe("#024 — review approval regex is too rigid", () => {
  const approvalPhrases = [
    "I approve this plan. Ready to implement.",
    "Plan approved — all tasks look correct and well-ordered.",
    "LGTM. The plan covers all acceptance criteria.",
    "This plan is approved. Let's proceed to implementation.",
    "Everything looks good. Approved.",
    "## Review Result\n\nApproved. No issues found.\n\nThe plan is comprehensive and well-structured.",
  ];

  for (const phrase of approvalPhrases) {
    it(`detects approval in: "${phrase.slice(0, 50)}..."`, () => {
      // Pad to >100 chars if needed for artifact save
      const text = phrase.length > 100 ? phrase : phrase + "\n\n" + "x".repeat(100);
      const result = processAgentOutput(text, "review", makeState({ phase: "review" }));
      expect(result.stateUpdate.reviewApproved).toBe(true);
    });
  }

  it("still rejects ambiguous non-approval", () => {
    const text = "I have concerns about Task 3. The dependency order seems wrong. Please revise the plan. " + "x".repeat(50);
    const result = processAgentOutput(text, "review", makeState({ phase: "review" }));
    expect(result.stateUpdate.reviewApproved).toBeUndefined();
  });
});

// =============================================================================
// Bug Cluster 2: Task completion tracking failures (#017, #019, #021, #029)
// =============================================================================

describe("#017 — [no-test] tasks not detected as complete", () => {
  const noTestCompletionPhrases = [
    "Nothing to do — the field already exists on the interface.",
    "No changes needed. The `noTest` property is already present.",
    "Already exists. The interface already has this field defined.",
    "This task requires no implementation — the functionality already exists.",
    "Task requires no changes. Already implemented in a prior issue.",
  ];

  for (const phrase of noTestCompletionPhrases) {
    it(`detects completion from: "${phrase.slice(0, 50)}..."`, () => {
      const state = makeState({
        phase: "implement",
        planTasks: [
          { index: 1, description: "Add noTest field [no-test]", completed: false, noTest: true },
          { index: 2, description: "Build handler", completed: false, noTest: false },
        ],
        currentTaskIndex: 0,
      });
      const result = processAgentOutput(phrase, "implement", state);
      expect(result.stateUpdate.planTasks).toBeDefined();
      expect(result.stateUpdate.planTasks![0].completed).toBe(true);
      expect(result.stateUpdate.currentTaskIndex).toBe(1);
    });
  }
});

describe("#019 — task completion signals with natural phrasing", () => {
  const completionSignals = [
    "Task 1 Complete. All tests passing.",
    "## Task 1 Complete\n\nAll tests written and passing. Production code implemented.",
    "Task 1 is done. Moving on to Task 2.",
    "Completed Task 1 successfully. Tests: 352 pass, 0 fail.",
  ];

  for (const signal of completionSignals) {
    it(`detects completion from: "${signal.slice(0, 50)}..."`, () => {
      const state = makeState({
        phase: "implement",
        planTasks: [
          { index: 1, description: "Setup", completed: false, noTest: false },
          { index: 2, description: "Build", completed: false, noTest: false },
        ],
        currentTaskIndex: 0,
      });
      const result = processAgentOutput(signal, "implement", state);
      expect(result.stateUpdate.planTasks).toBeDefined();
      expect(result.stateUpdate.planTasks![0].completed).toBe(true);
    });
  }
});

describe("#029 — state.json should be re-read before mutations", () => {
  // This test demonstrates the architectural issue: processAgentOutput is pure,
  // but the caller in index.ts uses a stale in-memory `state` variable.
  // The fix requires the caller to read from disk before applying updates.

  it("demonstrates stale state overwrite: in-memory state has fewer completed tasks than file state", () => {
    // Simulate: file state has task 1 completed (from a prior save)
    const fileState = makeState({
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: true, noTest: false },
        { index: 2, description: "B", completed: false, noTest: false },
        { index: 3, description: "C", completed: false, noTest: false },
      ],
      currentTaskIndex: 1,
    });

    // Simulate: stale in-memory state still has task 1 incomplete
    const staleMemoryState = makeState({
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: false, noTest: false },
        { index: 2, description: "B", completed: false, noTest: false },
        { index: 3, description: "C", completed: false, noTest: false },
      ],
      currentTaskIndex: 0,
    });

    // LLM completes task 2 — but processAgentOutput receives stale state
    const text = "Task complete.";
    const result = processAgentOutput(text, "implement", staleMemoryState);

    // The result marks task at currentTaskIndex (0) as complete — that's task 1
    // But task 1 was ALREADY complete on disk. Task 2 was the one being worked on.
    // This demonstrates the stale-state overwrite problem.
    expect(result.stateUpdate.planTasks![0].completed).toBe(true);

    // After `state = { ...staleMemoryState, ...result.stateUpdate }`:
    const merged = { ...staleMemoryState, ...result.stateUpdate };
    // Task 1 completed count: 1. But file state had task 1 already done + task 2 was being worked on.
    // The merge lost the file state's task 1 completion context.
    const mergedCompleted = merged.planTasks!.filter(t => t.completed).length;
    const fileCompleted = fileState.planTasks.filter(t => t.completed).length;

    // This SHOULD be >=fileCompleted if state were read-before-write.
    // Instead, the stale state may produce equal or fewer completions than the file.
    // We assert the bug: merged state only has 1 completed, same as file, but it's the WRONG task.
    expect(mergedCompleted).toBe(1);
    expect(merged.currentTaskIndex).toBe(1);
    // Task 1 is marked complete in both, but in the merged state, the system thinks it just
    // completed task 1 and is moving to task 2. In reality, task 1 was already done and task 2
    // was the current work. The stale in-memory state caused the system to re-complete task 1
    // instead of completing task 2.
  });
});

describe("#006 — acceptance criteria extracted but lost on session boundaries", () => {
  it("processAgentOutput correctly extracts criteria from spec", () => {
    const text = `## Goal\nBuild X.\n\n## Acceptance Criteria\n1. User can log in\n2. User sees dashboard\n3. Error messages display correctly\n\n## Open Questions\nNone\n`;
    const result = processAgentOutput(text, "spec", makeState({ phase: "spec" }));

    // Extraction itself works — this passes
    expect(result.stateUpdate.acceptanceCriteria).toHaveLength(3);
  });

  it("criteria survive a simulated shutdown guard (same phase, empty criteria in file)", () => {
    // Simulate: agent_end just set criteria in memory
    const memoryState = makeState({
      phase: "spec",
      acceptanceCriteria: [
        { id: 1, text: "User can log in", status: "pending" as const },
        { id: 2, text: "User sees dashboard", status: "pending" as const },
      ],
    });

    // Simulate: file state was saved BEFORE criteria were extracted (stale)
    const fileState = makeState({
      phase: "spec",
      acceptanceCriteria: [], // empty — saved before extraction
    });

    // The shutdown handler in index.ts compares phases:
    // Both are "spec" — same phase. The handler falls through to save in-memory state.
    // In this case, the in-memory state WITH criteria should win. This test documents
    // that the current shutdown logic happens to preserve criteria when both are in "spec" phase.

    // BUT: if the file state had advanced to "plan" (e.g., user manually advanced),
    // the shutdown guard would skip the save, and the criteria would be lost on next load.
    const fileStateAdvanced = makeState({
      phase: "plan",
      acceptanceCriteria: [], // empty — never got the criteria
    });

    const phaseOrder = ["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "done"];
    const filePhaseIdx = phaseOrder.indexOf(fileStateAdvanced.phase!);
    const memPhaseIdx = phaseOrder.indexOf(memoryState.phase!);

    // File is at plan (idx 2), memory is at spec (idx 1) → file is ahead → skip save
    expect(filePhaseIdx).toBeGreaterThan(memPhaseIdx);
    // This means the criteria in memory are LOST — they never get persisted.
    // The fix: criteria should be persisted immediately when extracted, not deferred to shutdown.
  });
});
