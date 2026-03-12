import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { preparePlanReviewContext } from "../extensions/megapowers/hooks.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  });
}

function createTaskFiles(tmp: string, count: number) {
  const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    writeFileSync(
      join(dir, `task-${String(i).padStart(3, "0")}.md`),
      `---\nid: ${i}\ntitle: Task ${i}\nstatus: draft\nfiles_to_modify:\n  - tests/fake-${i}.ts\nfiles_to_create: []\n---\nTask body ${i}.`,
    );
  }
}

describe("preparePlanReviewContext", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-focused-review-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("does not invoke focused review fan-out when the current plan has fewer than five tasks", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 4);

    let called = 0;
    await preparePlanReviewContext(tmp, async () => {
      called += 1;
      return {
        ran: false,
        runtime: "pi-subagents",
        mode: "parallel",
        availableArtifacts: [],
        unavailableArtifacts: [],
        message: "not triggered",
      };
    });

    expect(called).toBe(0);
  });

  it("invokes focused review fan-out for plan review sessions with five or more tasks", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 5);

    let captured: any = null;
    await preparePlanReviewContext(tmp, async (params) => {
      captured = params;
      return {
        ran: true,
        runtime: "pi-subagents",
        mode: "parallel",
        availableArtifacts: [],
        unavailableArtifacts: ["coverage-review.md"],
        message: "Unavailable focused review artifacts: coverage-review.md",
      };
    });

    expect(captured).toEqual({
      cwd: tmp,
      issueSlug: "001-test",
      workflow: "feature",
      taskCount: 5,
    });
  });

  it("does not invoke focused review fan-out from an advisory subagent session", async () => {
    const originalDepth = process.env.PI_SUBAGENT_DEPTH;
    process.env.PI_SUBAGENT_DEPTH = "1";

    try {
      setState(tmp, { phase: "plan", planMode: "review" });
      createTaskFiles(tmp, 6);

      let called = 0;
      await preparePlanReviewContext(tmp, async () => {
        called += 1;
        return {
          ran: true,
          runtime: "pi-subagents",
          mode: "parallel",
          availableArtifacts: [],
          unavailableArtifacts: [],
          message: "should not run",
        };
      });

      expect(called).toBe(0);
    } finally {
      if (originalDepth === undefined) {
        delete process.env.PI_SUBAGENT_DEPTH;
      } else {
        process.env.PI_SUBAGENT_DEPTH = originalDepth;
      }
    }
  });

  it("soft-fails when focused review fan-out throws so review can still proceed", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 6);

    await preparePlanReviewContext(tmp, async () => {
      throw new Error("subagent timeout");
    });
  });
});
