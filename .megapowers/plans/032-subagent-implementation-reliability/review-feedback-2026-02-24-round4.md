# Plan Review (Round 4): 032-subagent-implementation-reliability

Date: 2026-02-24
Reviewer: pi (plan sanity check)

## Scope
Quick sanity check for **coverage / ordering / completeness**. Not a deep audit.

## High-level assessment
The plan is *close* and is generally well-structured: tasks are mostly self-contained, have tests, and map cleanly to the acceptance criteria.

However, there are a few **blocking mismatches with the existing codebase / APIs** that will cause implementation churn unless addressed now.

---

## 1) Coverage vs Acceptance Criteria

**All ACs appear to be addressed** by at least one task.

Notable “likely-to-pass” mappings:
- **AC1–AC2 (tool registration):** Task 13
- **AC3/AC9 (jj workspace lifecycle):** Tasks 6 + 13
- **AC12–AC14 (agent defs + schema):** Tasks 1–3 + 2
- **AC18–AC19 (depends validation + task context):** Tasks 9 + 7 + 11
- **AC21 (UPSTREAM.md):** Task 15

### Coverage risk: AC5 (who writes `status.json`)
AC5 wording says **“spawned pi subprocess writes status.json”**.

Current plan: **parent session** writes/merges `status.json` by parsing the child’s JSONL output.

This can work, but it’s a spec mismatch. If AC5 is interpreted strictly, implementation should add **satellite-side status writing** (child writes status) using `MEGA_SUBAGENT_ID` + `MEGA_PROJECT_ROOT`.

Actionable fix:
- Either **clarify/adjust the spec interpretation** (status is written by the supervising parent), *or*
- Add a small task to implement **satellite status updates** (write running status on `message_end`, terminal status on process exit hooks if available).

---

## 2) Ordering / dependencies

Task dependency ordering is mostly sound.

### Minor ordering concern
- **Task 12 (satellite root resolution)** modifies `extensions/megapowers/index.ts` satellite behavior.
  - That change is independent and can happen before Task 13, so dependency is fine.
  - But it should be implemented **before** trying to validate AC16 end-to-end.

No other obvious ordering problems.

---

## 3) Completeness / implementability

### Blocking issue A: `pi.exec()` does not appear to support `{ cwd }`
The plan’s Task 13 snippet uses:
- `await pi.exec("jj", args, { cwd: config.workspacePath })`

In the current codebase, `createJJ()` wraps `pi.exec("jj", args)` with **only two arguments** (see `extensions/megapowers/jj.ts`). There are no existing call sites passing options.

Why this matters:
- You need `jj diff` / `jj diff --summary` to run **in the subagent workspace working copy** to reflect its `@`.
- Without a reliable way to run jj in the workspace cwd, AC6/AC7 outputs will be wrong.

Actionable fix (pick one and bake it into the plan):
1. Use **Node child_process** for jj commands that require a specific cwd (`spawn/execFile` with `cwd: workspacePath`).
2. Or run through a shell: `pi.exec("bash", ["-lc", `cd "${workspacePath}" && jj diff ...`])`.
3. Or use jj flags if available (less recommended unless you verify exact semantics).

Concrete plan change:
- Update **Task 13** to define a helper like `runJjInWorkspace(workspacePath, args)` and use it for:
  - `jj diff --summary`
  - `jj diff`

### Blocking issue B: Frontmatter parsing is not really YAML
Task 1’s `parseAgentFrontmatter()` is a line-based `key: value` parser.

Compatibility risk:
- YAML frontmatter commonly uses multiline arrays:
  - `tools:\n  - read\n  - bash`
- Quoted strings, comments, and more complex YAML will fail.

Actionable fix:
- Use a real YAML parser (e.g. `yaml` / `js-yaml`) or implement a minimal-but-correct subset that supports:
  - `tools: [a, b]`
  - `tools: a, b`
  - `tools:` + `- item` lines

If you keep the lightweight parser, explicitly constrain the supported frontmatter format and ensure builtin agents conform.

### Blocking issue C: JSONL event schema assumptions need one more validation step
Task 8 assumes event types:
- `tool_execution_start`
- `tool_execution_end`
- `message_end`

This may be correct (and matches your revision notes), but it’s brittle.

Actionable fix:
- Add a **small “fixture” test** using a captured JSONL snippet from pi (or from the upstream example) to lock the schema.
- Or, in `processJsonlLine()`, tolerate alternate keys (e.g. `tool_call_id`/`toolCallId`) if pi changes naming.

### Non-blocking but important polish

1) **`processJsonlLine()` defines `isTestCommand()` but doesn’t use it.**
   - Right now, any bash output containing `"X pass"`/`"Y fail"` can flip `lastTestPassed`.
   - Use the correlated `pendingToolCalls.get(toolCallId)?.args.command` and gate test parsing on `isTestCommand(command)`.

2) **Status file atomicity:**
   - `writeSubagentStatus()` uses `writeFileSync` directly.
   - `subagent_status` can read while a write is in progress.
   - Consider atomic temp-write-then-rename (same pattern as `state-io.ts`) to avoid partial JSON reads.

3) **Project root assumptions:**
   - Many functions assume `ctx.cwd` is the project root.
   - You’re already introducing `MEGA_PROJECT_ROOT` for satellites; consider reusing a similar “resolve root” helper for the primary session too, or explicitly document “run pi from repo root”.

---

## Verdict: **revise**

The plan is nearly ready, but I recommend revising before implementation to avoid expensive rework.

### Required revisions (minimum)
1) **Task 13:** remove unsupported `pi.exec(..., { cwd })` usage; introduce a supported way to run `jj diff` in the workspace working copy.
2) **Task 1:** upgrade frontmatter parsing to support real YAML-ish tool lists (at least multiline `-` arrays), or explicitly narrow the format and enforce it.
3) **AC5 clarification:** decide whether the **child** writes status (strict reading) or the **parent supervisor** writes it, and align plan/tests accordingly.

### Optional revisions (recommended)
- Gate test result detection on the originating bash command (`isTestCommand`).
- Make `status.json` writes atomic.

---

## Questions for confirmation
1) For **AC5**, do you want to treat “subprocess writes status.json” literally (child writes), or is “supervisor writes” acceptable?
2) Should we assume **pi is always run from repo root**, or should we make tool paths/root resolution robust for subdirectory cwd?
