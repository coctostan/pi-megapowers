# Plan Review — Issue 032: Subagent Implementation Reliability

This review is a **sanity + correctness** pass focused on preventing plan mistakes from becoming implementation bugs.

I checked the existing codebase using **kota** lookups (notably `state-io.ts`, `write-policy.ts`, `index.ts`, and pi’s `--mode json` event stream implementation in `pi-coding-agent/dist/modes/print-mode.js` + `dist/core/agent-session.js`).

---

## Verdict: **revise**

There are several **blocking correctness gaps** where the current plan will either:
- fail tests immediately,
- fail to satisfy acceptance criteria as written, or
- produce a “works sometimes” subagent runner (the most dangerous failure mode).

I’m listing fixes as **actionable edits** to specific tasks.

---

## 1) Coverage (Acceptance Criteria)

### AC16 (Satellite TDD enforcement) — **NOT actually satisfied with current approach**
**Why:** Satellite mode enforcement reads coordination state via:
- `readState(ctx.cwd)` in `extensions/megapowers/index.ts` satellite branch.
- `readState()` in `extensions/megapowers/state-io.ts` only looks at `join(cwd, ".megapowers/state.json")`.

But the plan spawns the child pi process with:
- `cwd: config.workspacePath` (the jj workspace dir).

In that workspace, `cwd/.megapowers/state.json` **does not exist**, so `readState()` returns `createInitialState()` (phase `null`), and `canWrite()` becomes **pass-through** (no TDD guard).

**Impact:** AC16 fails silently: subagent sessions will not enforce satellite TDD unless you add a project-root resolution mechanism.

**Plan fix:** add a task (new) to make satellite mode read state from the *project root*:
- Option A (cleanest): pass `MEGA_PROJECT_ROOT` env var to child and make `readState()/writeState()` accept an override root.
- Option B: update `readState()` to search up ancestors for a directory that contains `.megapowers/state.json`.

This must be done **before** Task 12 wiring.

---

### AC5 (status.json includes `phase`) — **broken by Task 12 status update loop**
Task 12 writes initial status with `phase`, but later “periodic status updates” overwrite status with an object that omits `phase`, which removes it.

**Impact:** AC5/Task 4 “phase field for running subagent” will fail in real operation.

**Plan fix:** either:
- change `writeSubagentStatus()` to merge with existing status (preserving fields), OR
- add `phase` to every running update (and preserve any other previously-written fields).

---

### AC7 (include jj diff output for review) — **plan uses only `jj diff --summary`**
The plan currently stores `diffResult.stdout` from `jj diff --summary`.

**Impact:** This does **not** satisfy “parent can review what actually changed” (summary lists files, not code changes). It also undercuts AC8 (“review before squash”) because you can’t review the actual patch.

**Plan fix:** include both:
- `jj diff --summary` → `filesChanged`
- `jj diff` (full patch) → `diff`

If full patch is too large for JSON, store it as `diff.patch` and reference it from status.

---

### AC20 (error detection from message stream) — **partially covered**
`detectRepeatedErrors()` exists, but `processJsonlLine()` only looks at (planned) tool results, not assistant message content.

**Plan fix:** extend error harvesting to include assistant `message_end` text too, because repeated failures often surface in assistant text (same exception repeated).

---

### AC5 wording vs implementation — status writer is parent, not child
AC5 says: *“The spawned pi subprocess writes a status.json file…”*. In Task 12’s current design, the **parent** process writes `status.json` by parsing the child’s stdout.

This can still work functionally, but it’s a spec mismatch.

**Plan fix (choose one):**
- Update AC5 wording to: “the subagent system writes status.json”, OR
- Actually have the **child** write status updates (requires passing the status dir path/env var and adding satellite-side status writing).

---

### AC6 (“structured data”) — current tool output is human text only
`handleSubagentStatus()` returns a structured `SubagentStatus` object, but the `subagent_status` tool (Task 12) formats a human-readable string.

If you want AC6 to be unambiguous and machine-safe, return JSON (either as the tool’s text content or in `details`).

---

## 2) Ordering (dependencies / task readiness)

### Task 8 (JSONL runner) must be fixed before Task 12 (tool wiring)
The current Task 8 assumptions about JSON events don’t match pi’s actual JSON output.

pi print-mode JSON output logs the **AgentSession events** (see `node_modules/@mariozechner/pi-coding-agent/dist/modes/print-mode.js`). The event types emitted include:
- `message_end`
- `tool_execution_start`
- `tool_execution_end`

There is **no** `tool_result_end` event in this stream.

**Impact:** Task 8 tests/implementation will be wrong, so Task 12 wiring that relies on it will be wrong.

**Plan fix:** update Task 8 to parse:
- `tool_execution_start` (capture `toolCallId`, `toolName`, and `args`)
- `tool_execution_end` (read `isError` + `result.content[]`)

Then detect test outcomes by correlating `toolCallId` with the start-event’s `args.command` for `bash`.

---

## 3) Completeness (task execution clarity / correctness)

### Task 2 builtin `scout.md` uses invalid `--tools`
`pi --tools` only accepts built-in tool names:
`read,bash,edit,write,grep,find,ls` (see `dist/cli/args.js`).

Plan’s `scout.md` uses `web_search` and `fetch_content`, which will be filtered out with warnings.

**Plan fix:** either:
- restrict scout tools to pi’s supported tool list, OR
- don’t pass `--tools` at all for scout and rely on defaults.

(If you truly need web search, that’s a separate feature: implement those tools inside pi or via an extension.)

---

### Task 12 appended test has a syntax error (`await` in non-async test)
The plan’s “satellite TDD enforcement” test uses `await import(...)` inside a non-`async` `it()` callback.

**Plan fix:** make the test callback `async () => { ... }`.

---

### Task 11 dependency validation is skipped when no plan tasks are found
Current logic:
- if `taskIndex` provided and `deriveTasks()` returns `[]`, dependency validation is skipped.

**Impact:** AC18 can be bypassed accidentally (or by missing plan.md).

**Plan fix:** when `taskIndex` is provided:
- require plan exists + tasks parsed, otherwise error.

---

### CLI prompt length risk (Task 8/12)
The subagent prompt includes plan section + learnings and is passed as a single positional CLI arg:
`"Task: <big markdown prompt>"`.

**Impact:** OS command line length limits can break dispatch unpredictably.

**Plan fix:** write the prompt to `.megapowers/subagents/<id>/prompt.md` and pass it as `@prompt.md` (pi supports `@file` args), or pass via stdin if supported.

---

### Status update semantics (Task 4 vs Task 12)
`writeSubagentStatus()` is “write whole object”, but Task 12 uses it for incremental updates without preserving optional fields.

**Plan fix:** add `updateSubagentStatus(cwd, id, patch)` that merges with the existing JSON (and optionally refuses to overwrite terminal states).

---

### Timeout/cleanup race (AC9/AC11)
In Task 12, the timeout handler kills the child and immediately attempts `jj workspace forget`.

**Risk:** `jj workspace forget` may fail if the child process is still running / has open handles in that workspace.

**Plan fix:** perform cleanup in a single place after process exit (or retry forget until it succeeds), e.g.:
1) send SIGTERM
2) after 5s send SIGKILL
3) wait for `close`
4) then `jj workspace forget`

---

### Workspace location under `.megapowers/`
The plan places the jj working copy at `.megapowers/subagents/<id>/workspace`.

That’s convenient for write-policy allowlisting, but it complicates “find project root” logic (AC16 fix) if you implement ancestor search. Be explicit about which `.megapowers` is the **project** `.megapowers` (not a nested one that could appear inside a workspace).

---

## Concrete change requests (by task)

### Task 2 (Builtin agents)
- Fix `agents/scout.md` tool list to use only pi-supported tools.

### Task 4 (Status protocol)
- Add `updateSubagentStatus()` merge semantics OR update `writeSubagentStatus()` to preserve existing fields.

### Task 8 (Runner)
- Replace `tool_result_end` handling with `tool_execution_start` + `tool_execution_end` parsing.
- Track `toolCallId → { toolName, args }` to detect when a `bash` command was a test run.
- Collect error candidates from both tool results and assistant messages.

### **New task (required)**: project-root resolution for satellites (AC16)
- Implement root discovery (env var or ancestor search) so subagent sessions can read the real `.megapowers/state.json`.
- Ensure child process sets whatever env/flags are needed.

### Task 12 (index.ts wiring)
- Preserve `phase` on every running status update.
- Store full `jj diff` (patch), not just `--summary`.

### Task 12 tests
- Fix async import usage.

### Task 11/9 (dependency validation)
- If `taskIndex` is provided but plan tasks can’t be derived, return an error.

---

## Final question for confirmation (before concluding)

Do you want AC5/AC6/AC7 results to be returned primarily as:
1) **JSON in the tool’s `content`** (easy for the LLM to parse),
2) a human summary + embedded JSON block, or
3) a human summary only?

This choice affects Task 12’s `subagent_status` output formatting.
