import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { onAgentEnd } from "../extensions/megapowers/hooks.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";

// --- helpers ---

function makeIssueFile(cwd: string, slug: string, id: number, status = "in-progress") {
  const issuesDir = join(cwd, ".megapowers", "issues");
  mkdirSync(issuesDir, { recursive: true });
  writeFileSync(join(issuesDir, `${slug}.md`), `---
id: ${id}
type: feature
status: ${status}
created: 2026-01-01T00:00:00.000Z
---

# Test Issue ${id}

Description
`);
}

function makeStore(cwd: string) {
  let featureDocContent = "";
  let changelogContent = "";
  const real = createStore(cwd);
  return {
    ...real,
    writeFeatureDoc: (slug: string, text: string) => {
      featureDocContent = text;
      real.writeFeatureDoc(slug, text);
    },
    appendChangelog: (text: string) => {
      changelogContent += text;
      real.appendChangelog(text);
    },
    _getFeatureDoc: () => featureDocContent,
    _getChangelog: () => changelogContent,
  };
}

function makeCtx(cwd: string, hasUI = false) {
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
    jj: null,
  };
}

function makeAgentEndEvent(text: string) {
  return {
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function setState(cwd: string, overrides: any) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test-issue",
    workflow: "feature",
    ...overrides,
  });
}

// ============================================================================
// Bug 1: close-issue done action is offered but never actually closes the issue
// ============================================================================

describe("Bug: close-issue done action never closes the issue", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-close-issue-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    makeIssueFile(tmp, "001-test-issue", 1, "in-progress");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("should mark the issue status as 'done' when close-issue action is processed", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    const longText = "All wrap-up actions are complete. The issue is ready to close. " +
      "Summary of completed actions: generated docs, wrote changelog, captured learnings.";

    await onAgentEnd(makeAgentEndEvent(longText), makeCtx(tmp), makeDeps(tmp) as any);

    // Verify the action was consumed
    const state = readState(tmp);
    expect(state.doneActions).toEqual([]);

    // BUG: The issue status should be updated to "done" but it isn't
    const store = createStore(tmp);
    const issue = store.getIssue("001-test-issue");
    expect(issue?.status).toBe("done");
  });

  it("should also auto-close source issues when a batch issue is closed", async () => {
    // Create source issues
    makeIssueFile(tmp, "010-source-a", 10, "open");
    makeIssueFile(tmp, "011-source-b", 11, "open");

    // Create a batch issue with sources
    const issuesDir = join(tmp, ".megapowers", "issues");
    writeFileSync(join(issuesDir, "020-batch-issue.md"), `---
id: 20
type: feature
status: in-progress
created: 2026-01-01T00:00:00.000Z
sources: [10, 11]
---

# Batch Issue

Combines source issues.
`);

    setState(tmp, {
      activeIssue: "020-batch-issue",
      phase: "done",
      doneActions: ["close-issue"],
    });

    const longText = "All wrap-up actions are complete. The batch issue and all source issues are ready to close. " +
      "Summary of completed actions: generated docs, wrote changelog.";

    await onAgentEnd(makeAgentEndEvent(longText), makeCtx(tmp), makeDeps(tmp) as any);

    const store = createStore(tmp);

    // BUG: Batch issue should be "done"
    const batch = store.getIssue("020-batch-issue");
    expect(batch?.status).toBe("done");

    // BUG: Source issues should also be marked "done"
    const sourceA = store.getIssue("010-source-a");
    const sourceB = store.getIssue("011-source-b");
    expect(sourceA?.status).toBe("done");
    expect(sourceB?.status).toBe("done");
  });
});

// ============================================================================
// Bug 2: close-issue action is stuck when LLM gives short response
// ============================================================================

describe("Bug: done actions that don't need LLM content get stuck on short responses", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-stuck-actions-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    makeIssueFile(tmp, "001-test-issue", 1, "in-progress");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("close-issue should work even when LLM response is short", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    // Short response — under 100 chars
    await onAgentEnd(makeAgentEndEvent("Issue closed."), makeCtx(tmp), makeDeps(tmp) as any);

    // BUG: close-issue should be processed/removed even when assistant text is short
    const state = readState(tmp);
    expect(state.doneActions).toEqual([]);

    // And the issue should be marked done
    const store = createStore(tmp);
    expect(store.getIssue("001-test-issue")?.status).toBe("done");
  });
});

// ============================================================================
// Bug 3: onContext hook called non-existent buildSessionContext() — ALREADY FIXED
// ============================================================================

describe("Bug (fixed): onContext hook should not call buildSessionContext()", () => {
  it("onContext is a no-op and does not throw", async () => {
    const { onContext } = await import("../extensions/megapowers/hooks.js");

    const ctx = {
      cwd: "/tmp/fake",
      sessionManager: {
        // Does NOT have buildSessionContext — that was the bug
      },
    };

    // Before the fix, this would throw: ctx.sessionManager.buildSessionContext is not a function
    const result = await onContext({ type: "context", messages: [] }, ctx, {} as any);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Bug 5: Subagent workspace creation fails — parent directory not created
// ============================================================================

import { createPipelineWorkspace, type ExecJJ } from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("Bug: subagent workspace creation fails on fresh repo", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "workspace-create-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("should create parent directories before calling jj workspace add", async () => {
    const calls: { args: string[]; opts?: { cwd?: string } }[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      // Simulate what jj does: check if parent dir exists
      const workspacePath = args[args.length - 1];
      const parentDir = join(workspacePath, "..");
      if (!existsSync(parentDir)) {
        return {
          code: 1,
          stdout: "",
          stderr: `Error: Cannot access ${workspacePath}\nCaused by: No such file or directory (os error 2)`,
        };
      }
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace(tmp, "oneshot-12345", execJJ);

    // BUG: The parent directory .megapowers/subagents/oneshot-12345/ is never created
    // so jj workspace add fails with ENOENT
    expect((r as any).error).toBeUndefined();
  });
});
