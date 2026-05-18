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
