# Plan Review: 032-subagent-implementation-reliability

Verdict: **revise**

This plan is directionally aligned with the spec, but several acceptance criteria are either not implemented by the proposed code, or the tasks as written are not independently executable (test compile issues, incorrect CLI flags, ordering mistakes). Below are concrete fixes to make the plan implementable and spec-compliant.

---

## 1) Coverage

### Gaps / incorrect coverage

- **AC5 (status.json updated as subagent progresses)**
  - Current plan only writes status twice: initial `running` and then a final `completed/failed/timed-out` in the `close`/timeout handlers.
  - There is **no streaming of subagent output** and **no incremental updates** (turn count, phase, partial output).
  - **Action:** add a runner that reads pi JSONL events from stdout and periodically calls `writeSubagentStatus()`.

- **AC6 (subagent_status returns turns used, test outcomes, detected errors, files changed)**
  - `turnsUsed` is always `0` in Task 12.
  - `testsPassed` is set to `true` solely when exit code is 0, which is not equivalent to “tests passed”.
  - `detectedErrors` is never populated; Task 5’s `detectRepeatedErrors()` is not integrated anywhere.
  - **Action:** integrate message stream parsing to:
    - increment turns on assistant message boundaries
    - detect test runner results (or clearly document what “testsPassed” means and implement that)
    - apply `detectRepeatedErrors()` to error lines and store in status

- **AC7 (include jj diff output when completed)**
  - Plan attempts `jj diff --summary -r "${workspaceName}@"`.
  - This revset is **very likely incorrect** for jj workspace referencing (jj uses working-copy revisions; workspace names are not obviously revset names).
  - **Action:** explicitly define a working approach:
    - run `jj diff --summary` **with `cwd` set to the workspace path** so `@` refers to that workspace’s working copy, OR
    - capture the subagent workspace’s change-id/bookmark and diff that.

- **AC9/AC11 (cleanup on all exit paths + timeout kill)**
  - Timeout handler writes a status with `startedAt: config.timeoutMs` (bug).
  - Potential race: the timeout handler writes `timed-out`, but the `close` handler may later overwrite status again.
  - Kill escalation is only `SIGTERM` and does not ensure the process is actually terminated.
  - **Action:**
    - store the real `startedAt` once and reuse it
    - ensure once a subagent is marked `timed-out`, the `close` handler does not overwrite it
    - implement SIGTERM→SIGKILL escalation (similar to pi’s example extension)

- **AC12 (agent discovery order includes user directory)**
  - Implementation uses `homeDir ?? require("node:os").homedir()` inside ESM source; this is inconsistent with the repo’s import style.
  - Tests don’t cover the user directory priority.
  - **Action:** use `import { homedir } from "node:os";` and add a test that sets `homeDir` to a temp dir and confirms lookup.

- **AC21 (UPSTREAM pinned commit)**
  - Planned `UPSTREAM.md` says **Pinned Commit: N/A**, but the spec requires a pinned commit reference.
  - **Action:** decide a commit hash now (even if only “HEAD at time of implementation”) or change spec (but spec is already accepted).

### OK / mostly covered

- AC1/AC2 tool registration is covered.
- AC3 workspace creation is covered conceptually (but see correctness issues in “Completeness”).
- AC4 PI_SUBAGENT env is covered.
- AC8 (no auto-squash) is covered.
- AC18 dependency validation is covered.
- AC19 plan-section extraction exists.
- AC20 has a pure detector (Task 5) but must be integrated (gap above).

---

## 2) Ordering

- **Task 2 should depend on Task 3**
  - Task 2’s tests require builtin agent files to exist (“falls back to builtin agents”), but those files are created in Task 3.
  - **Fix:** change title to `### Task 2: Agent discovery with priority search [depends: 1, 3]` or move Task 3 before Task 2.

- **Task 12 depends on runtime behavior that earlier tasks don’t implement**
  - Tool wiring in Task 12 assumes the spawn args/flags are correct and that status tracking is meaningful. Right now they are not.
  - **Fix:** insert a dedicated “runner integration” task (reads JSONL, counts turns, extracts errors/tests) before Task 12, and make Task 12 depend on it.

---

## 3) Completeness (self-contained + runnable)

### Tests that won’t compile/run as written

- Multiple test snippets use `beforeEach` / `afterEach` but don’t import them from `bun:test` (e.g., Task 2 appends `beforeEach`/`afterEach`).
- Several appended snippets use `require(...)` inside TypeScript ESM tests. The repo’s tests currently use ESM imports. Even if Bun supports `require`, this is inconsistent and brittle.

**Fix:** normalize tests to:
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
```
and use ESM imports for node modules.

### `pi` CLI invocation appears incorrect

- Task 9’s `buildSpawnArgs()` uses `pi --prompt <text> --non-interactive`.
- The upstream pi example `examples/extensions/subagent/index.ts` uses:
  - `pi --mode json -p --no-session` and passes the prompt as a positional argument (e.g., `"Task: ..."`).

**Fix:** revise Task 9/12 to use the known working invocation pattern:
- `spawn("pi", ["--mode", "json", "-p", "--no-session", ...flags, prompt], ...)`
- parse stdout JSONL events for messages/tool results.

### jj workspace path assumption

- Plan hardcodes workspace path as `${cwd}/.jj/working-copies/${workspaceName}`.
- `jj workspace add` accepts a path; but using `.jj/working-copies` directly is a repo-internal detail and may not be stable.

**Fix:** create workspace directories under `.megapowers/subagents/<id>/workspace` (or a temp dir) and pass that path to `jj workspace add`.

### Incorrect status fields

- Timeout handler writes `startedAt: config.timeoutMs` (typo/bug).
- Completion and failure handlers set `startedAt: Date.now()` again rather than preserving the original `startedAt`.

**Fix:** write `startedAt` once, then update only the mutable fields.

### Missing “jj is required” guard

- Spec says jj is required; plan should fail fast if not a jj repo or `jj` missing.
- Current plan proceeds and will produce confusing spawn errors.

**Fix:** before creating a workspace, call `jj.isJJRepo()` (or run `jj root`) and return a clear error if false.

---

## Recommended adjustments (minimal)

If you want to keep the task list mostly intact, update these tasks:

1. **Revise Task 2 dependencies** (depends on Task 3) + fix test imports.
2. **Revise Task 9/12 spawn mechanism** to match known `pi` JSON mode flags.
3. **Add a new task before Task 12**: “Runner reads JSONL and updates status.json incrementally”
   - should satisfy AC5/AC6/AC20 (turn counting + error heuristics integration).
4. **Revise workspace path strategy** to avoid `.jj/working-copies` hardcoding.
5. **Fix timeout + cleanup race** (ensure terminal status isn’t overwritten).
6. **Update UPSTREAM.md to include a pinned commit hash**.

---

## Final verdict

**revise** — the plan is not yet ready to approve because AC5/AC6/AC20/AC21 are not satisfied by the proposed implementation, and several tasks/tests are not executable as written.
