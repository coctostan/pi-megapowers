## Task 9: Orchestrate finalize, squash, push, and PR as one shipping path

You need to tighten this task so it *actually* proves AC14/AC15 and follows one-behavior-per-test granularity.

### 1) Split Step 1 into focused tests
The current single test mixes:
- happy path orchestration,
- validate-target rejection,
- and partial ordering checks.

Move the validate-target assertions out of this task (they are already covered in Task 5).

Add **two** tests here:

### Test A (AC14): PR check occurs only after push succeeds
Use a shared event timeline across both `execGit` and `execCmd` so ordering is testable across subsystems:

```ts
const events: string[] = [];
const execGit: ExecGit = async (args) => {
  events.push(`git ${args.join(" ")}`);
  if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
  if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
  return { stdout: "", stderr: "" };
};

const execCmd: ExecCmd = async (cmd, args) => {
  events.push(`${cmd} ${args.join(" ")}`);
  throw new Error("command not found: gh");
};

// ... call shipAndCreatePR(...)

expect(events).toEqual([
  "git status --porcelain --untracked-files=all --ignored",
  "git reset --soft main",
  "git status --porcelain",
  "git push origin feat/093-vcs-lifecycle-audit-clean-commit-strateg --force-with-lease",
  "gh --version",
]);
```

This verifies `gh --version` happens only after the push attempt succeeds.

### Test B (AC15): push failure must skip PR creation
Add a dedicated push-failure test with an explicit `prAttempted` flag:

```ts
let prAttempted = false;
const execCmd: ExecCmd = async () => {
  prAttempted = true;
  return { stdout: "", stderr: "" };
};

const execGit: ExecGit = async (args) => {
  if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
  if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
  if (args[0] === "push") throw new Error("remote rejected");
  return { stdout: "", stderr: "" };
};

const result = await shipAndCreatePR({ ... });
expect(result).toEqual({ ok: false, step: "push", error: "remote rejected", pushed: false });
expect(prAttempted).toBe(false);
```

### 2) Step 2 failure message
Update Step 2 text so the expected failure is still accurate at Task 9 start state (missing `shipAndCreatePR` export), but do not mention behaviors that are only asserted indirectly.

---

## Task 13: Surface PR creation failures without hiding a successful push

This task violates granularity by testing two behaviors in one `it(...)` block.

### What to change
Keep this task focused on AC17 only (PR failure after successful push).

- Keep the first scenario (`authentication required`) in this task.
- Remove the second "gh missing" scenario from this task’s primary test block.
  - GH-missing skip behavior is already covered by Task 8 + Task 9 path assertions.

### Replace Step 1 test body structure
Use a single scenario:

```ts
it("returns a targeted PR error while preserving the earlier successful push result", async () => {
  // execGit success path for finalize + squash + push
  // execCmd: --version succeeds, gh pr create throws "authentication required"
  // expect { ok: false, step: "pr", error: "authentication required", pushed: true, pr: { ok: false, error: "authentication required" } }
});
```

### Step 2 expected failure
Keep it specific to the PR-failure branch mismatch only (`ok: true` vs expected `ok: false, step: "pr"`).

---

## Task 17: Add an automated coverage audit for VCS lifecycle test suites

This task should be removed or rewritten; the current design is brittle and non-deterministic.

### Problems to fix
1. It spawns `bun test` from inside a test (`spawnSync("bun", ["test", ...])`), which is heavy and flaky.
2. It asserts string literals from test source titles (e.g. `toContain("...test name...")`), which is not behavior coverage.
3. Step 2 expected failure is no longer valid with current dependencies.

### Required revision
**Remove this task from the plan** (preferred), or fully replace it with a behavior-level regression test (not source-string audits, not nested runner invocation).

AC18 is already substantively covered by:
- new unit tests in Tasks 2, 4, 5, 6, 7, 8, 9, 12, 13,
- integration regression in Task 15,
- activation regression in Task 16,
- CLI wiring in Task 18.

If you keep Task 17, it must add real runtime assertions against exported APIs (e.g., `shipAndCreatePR`, `handleIssueCommand`) and use normal `bun:test` execution only.
