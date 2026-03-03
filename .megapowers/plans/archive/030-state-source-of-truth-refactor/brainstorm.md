# Brainstorm: State Source of Truth Refactor

## Problem

Megapowers has three competing sources of truth that constantly conflict:

1. **In-memory `state` variable** in `index.ts` — mutated throughout the session, dumped on shutdown
2. **`state.json` on disk** — written sporadically via `store.saveState()`, read on startup
3. **Artifact files** (`plan.md`, `spec.md`, etc.) — the actual ground truth for derived data like task lists and acceptance criteria, but only parsed at specific moments

Layered on top: **fragile regex-based signal detection** in `artifact-router.ts` parses LLM prose to detect phase transitions, task completion, review approval, and artifact boundaries. When the regex misses, state never updates, and everything downstream breaks.

All 8 source issues (#006, #017, #019, #021, #023, #024, #028, #029) trace back to one or both of these root causes.

## Architectural Principles

These are permanent rules for the codebase, not just guidelines for this refactor:

### 1. Tools over regex — always
When the runtime needs to know something happened, the LLM calls a tool. Never parse assistant message text to detect signals. Prompts instruct the LLM which tool to call and when. This is deterministic, schema-validated, and testable.

### 2. Disk over memory — always
`state.json` is the source of truth for progress/coordination state. Every mutation writes through to disk immediately. When you need state, you read from disk. No in-memory cache. **One documented exception:** satellite (subagent) TDD cycle state is in-memory because subagents are short-lived and must not compete with the primary session for state.json writes.

### 3. Artifacts over state — for structure
Task lists come from `plan.md`. Acceptance criteria come from `spec.md`. Open questions come from `spec.md`. These are derived on read from artifact files, never cached in `state.json`. If the artifact exists, the structure is available.

### 4. Explicit over implicit — for everything
No magic. No regex. No "if the LLM happens to say the right words." Every state transition has a clear, auditable trigger: a tool call with typed parameters, or a user slash command.

## Approach

Replace megapowers' fragile signal detection and split state model with a tool-first, disk-first architecture. Instead of parsing LLM prose with regex to detect state transitions (task completion, review approval, phase advancement), the LLM calls structured tools — `megapowers_signal` for state transitions and `megapowers_save_artifact` for persisting phase outputs. Instead of maintaining an in-memory state variable that drifts from `state.json`, every state access reads from disk and every mutation writes through immediately. There is no in-memory cache.

The built-in `write`, `edit`, and `bash` tools are overridden by name to enforce phase-based write policies. In brainstorm/spec/plan/review/verify/done, source code writes are blocked entirely. In implement and code-review, writes are TDD-guarded: test files must be written and fail before production code is allowed. The bash override tracks test runner results on disk. Because the override *is* the tool, enforcement is impossible to bypass — no event handler to miss, no in-memory state to desync.

Structural data (task lists from `plan.md`, acceptance criteria from `spec.md`, open questions from `spec.md`) is never cached in `state.json`. It's derived on demand by parsing the artifact files. `state.json` stores only coordination and progress data: active issue, current phase, task index, completed task indices, review approval, TDD cycle state, and jj change IDs. A `/mega off` slash command (session-scoped) makes all overrides passthrough for when the user needs vanilla pi behavior.

jj operations are embedded directly in tool handlers: `phase_next` to implement creates the issue-level jj change, `task_done` inspects the task's jj change diff and creates the next task's change, done phase squashes task changes into the parent. This positions jj as both the VCS and the ground-truth record of what work was actually done per task.

## Key Decisions

- **Two custom tools (hybrid model).** `megapowers_signal({ action })` for lightweight state signals (task_done, review_approve, phase_next) — all actions are parameter-light so a single tool with an enum works well. `megapowers_save_artifact({ phase, content })` for persisting phase output — structurally different enough to warrant its own tool.
- **Override stock tools by name.** `write`/`edit`/`bash` are replaced transparently using pi's tool-override API. The LLM calls `write` as normal — our logic runs. Enforcement is impossible to bypass. Built-in rendering (diffs, syntax highlighting) is preserved automatically.
- **Phase-based write policies.** Each phase has a defined write permission scope: brainstorm/spec/plan/review/verify/done block all source code writes; implement and code-review allow TDD-guarded writes; `.megapowers/` paths are always writable. Encoded as a pure function for testability.
- **`state.json` is thin.** Contains only: `activeIssue`, `workflow`, `phase`, `phaseHistory`, `currentTaskIndex`, `completedTasks: number[]`, `reviewApproved`, `tddTaskState`, `taskJJChanges`, `jjChangeId`, `doneMode`, `megaEnabled`. No derived data (no `planTasks` array, no `acceptanceCriteria` array).
- **jj operations in tool handlers.** `task_done` calls `inspectTaskChange` and `createTaskChange`. `phase_next` to implement creates the issue-level change. Done phase squashes. Consolidates jj logic scattered across event handlers.
- **Auto-advance on last task.** When `task_done` completes the final task, the handler automatically advances phase to verify. The gate is trivially satisfied; requiring a separate `phase_next` call is busywork.
- **Shared `advancePhase()` function.** Extracted as a pure read→gate→mutate→write function called by three entry points: `megapowers_signal`, `/phase next` slash command, and any remaining TUI interactions.
- **`/mega off` as session-scoped escape hatch.** Sets `megaEnabled: false` in state. All tool overrides become pure passthrough, no prompt injection, no TUI overlay, custom tools hidden. Resets to on at session start.
- **Two-layer prompt architecture.** A base "megapowers protocol" section injected into every prompt (tool descriptions, error handling pattern: read error → fix → retry). Plus phase-specific tool instructions telling the LLM exactly which calls to make.
- **Self-diagnosing error messages.** Every tool rejection tells the LLM what's wrong and what to fix. No special per-error prompt instructions needed.
- **Done-phase artifacts via tool.** The LLM calls `megapowers_save_artifact` for feature docs, changelog, etc. No more parsing done-phase output from LLM prose.
- **Session entries eliminated.** No more `pi.appendEntry`. Disk is truth. Session recovery = read `state.json`. If corrupt, start fresh.
- **Satellite mode simplified.** Subagent processes get tool overrides (write/edit/bash with TDD enforcement) automatically. They do NOT get megapowers_signal or megapowers_save_artifact. TDD cycle state is in-memory (the one documented exception).

## Architecture

### Tools

- **`megapowers_signal({ action })`** — State transitions. Actions: `task_done`, `review_approve`, `phase_next`. Each reads state from disk, validates gates, mutates, writes back, returns confirmation or actionable error.
- **`megapowers_save_artifact({ phase, content })`** — Persists phase output. Writes to `.megapowers/plans/{issue}/{phase}.md`. No state side effects.
- **`write`/`edit` overrides** — Read state from disk. Check phase + write policy. Block source code in non-impl phases. Track TDD state (test file written). Perform actual write if allowed.
- **`bash` override** — Execute command. Detect test runner commands. Record test results in state (ran red, passed green). Return result.

### State tiers

- **`state.json`** — Thin coordination file. Progress + coordination data only.
- **Artifact files** (`plan.md`, `spec.md`, etc.) — Structure. Parsed on demand by existing parsers.
- **jj changes** — Ground truth for what work was actually done per task.

### Phase-based write policy

| Phase | Source code writes | Artifact writes | Bash |
|---|---|---|---|
| brainstorm | ❌ blocked | ✅ `.megapowers/` only | ✅ unrestricted |
| spec | ❌ blocked | ✅ `.megapowers/` only | ✅ unrestricted |
| plan | ❌ blocked | ✅ `.megapowers/` only | ✅ unrestricted |
| review | ❌ blocked | ✅ `.megapowers/` only | ✅ unrestricted |
| implement | 🔒 TDD-guarded | ✅ `.megapowers/` only | ✅ (tracks test results) |
| verify | ❌ blocked | ✅ `.megapowers/` only | ✅ unrestricted |
| code-review | 🔒 TDD-guarded | ✅ `.megapowers/` only | ✅ (tracks test results) |
| done | ❌ blocked | ✅ `.megapowers/` only | ✅ unrestricted |

### `/mega off` behavior

| Capability | ON | OFF |
|---|---|---|
| Tool overrides | Phase-based enforcement | Pure passthrough |
| Prompt injection | Phase-specific system prompt | None |
| Custom tools | Available | Hidden |
| TUI overlay | Full dashboard | "MEGA OFF" indicator |
| Event handlers | Active | No-op |

## Data Flow

Every state mutation follows: **read → validate → mutate → write → respond.**

### Flow 1: LLM signals task completion
```
megapowers_signal({ action: "task_done" })
  → readState() from disk
  → parse plan.md to get task list
  → validate: is current task [no-test]? if not, check tddTaskState
  → mutate: add currentTaskIndex to completedTasks[], advance index
  → jj: inspect task change, create next task change
  → if all tasks done: auto-advance phase to verify
  → writeState() to disk
  → return confirmation + next task info
```

### Flow 2: LLM writes a production file
```
write({ path, content })
  → readState() from disk
  → not in implement phase? → just write
  → task is [no-test]? → just write
  → path is test file? → write, set testFileWritten in state, writeState()
  → path is production file? → check testsRanRed in state
    → false: return error "Write tests first"
    → true: write the file
```

### Flow 3: LLM runs bash
```
bash({ command })
  → execute command
  → not in implement phase? → return result
  → is test runner command? → read state, record result, writeState()
  → return result
```

### Flow 4: Phase gate check
```
megapowers_signal({ action: "phase_next" })
  → readState()
  → read artifact files for gate checks
  → validate gate conditions
  → if blocked: return error with reason
  → if clear: mutate phase, writeState(), return confirmation
```

## Error Handling

1. **Tool call rejected by gate** — Returns actionable error: "Cannot advance to plan: spec.md has 2 open questions. Resolve them first."
2. **Artifact file missing** — Returns: "Cannot advance: spec.md not found. Use megapowers_save_artifact to save the spec first."
3. **`state.json` corrupted or missing** — `readState()` returns initial state. System gracefully degrades to "start fresh."
4. **LLM doesn't call tool** — System stays in current state. User notices via TUI, uses slash command fallback.
5. **Disk write fails** — Tool returns error. State unchanged. Atomic writes (temp + rename) prevent partial corruption.
6. **Plan.md parse fails** — Returns: "No tasks found in plan.md. Check the plan format."

### Prompt error handling protocol
```
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly.
```

## State Ownership Model

| Data | Owner | Location | Access |
|---|---|---|---|
| Active issue, workflow, phase | Coordination | `state.json` | Read/write via state-io |
| Phase history | Coordination | `state.json` | Append via state-io |
| Current task index | Progress | `state.json` | Read/write via state-io |
| Completed task indices | Progress | `state.json` | Read/write via state-io |
| Review approved | Progress | `state.json` | Read/write via state-io |
| TDD cycle state | Progress | `state.json` (primary) / memory (satellite) | Read/write |
| jj change IDs | Coordination | `state.json` | Read/write via state-io |
| Mega enabled flag | Coordination | `state.json` (session-scoped) | Read/write via state-io |
| Done mode | UI state | `state.json` | Read/write via state-io |
| Task list structure | Derived | `plan.md` | Parsed on demand |
| Acceptance criteria | Derived | `spec.md` | Parsed on demand |
| Open questions | Derived | `spec.md` | Parsed on demand |
| Phase artifacts | Content | `.megapowers/plans/{issue}/*.md` | Written by tool |
| Issue definitions | Content | `.megapowers/issues/*.md` | Managed by store |

## Components

### New modules
- **`state-io.ts`** — `readState(cwd)` and `writeState(cwd, state)`. Atomic writes. Only module that touches `state.json`.
- **`tool-signal.ts`** — `megapowers_signal` handler. Dispatches task_done, review_approve, phase_next.
- **`tool-artifact.ts`** — `megapowers_save_artifact` handler. Writes artifact files.
- **`tool-overrides.ts`** — `write`/`edit`/`bash` overrides. Phase-based write policy + TDD tracking.
- **`write-policy.ts`** — Pure function: `canWrite(phase, filePath, taskIsNoTest, tddState)`.
- **`phase-advance.ts`** — Shared `advancePhase()` function. Read→gate→mutate→write.

### Refactored modules
- **`gates.ts`** — Reads from both state.json (progress) and artifact files (structure).
- **`spec-parser.ts`** — `hasOpenQuestions()` fixed for "None"/"N/A" sentinels.
- **`prompts/*.md`** — Updated with megapowers protocol + phase-specific tool instructions.
- **`index.ts`** — Registers tools/overrides. No module-level state variable. Simplified event handlers.
- **`ui.ts`** — Dashboard reads from disk. Delegates transitions to shared functions.
- **`store.ts`** — Retains issue CRUD. State save/load replaced by state-io.
- **`state-machine.ts`** — Type updated: removes `planTasks`/`acceptanceCriteria`, adds `completedTasks`/`megaEnabled`.

### Deleted modules
- **`artifact-router.ts`** — Replaced by tools.
- **`tdd-guard.ts`** — Replaced by tool overrides + write-policy.
- **`state-recovery.ts`** — Replaced by simple `readState()`.
- **`satellite-tdd.ts`** — Replaced by mode flag in tool-overrides.

### Slash commands
- `/mega off` / `/mega on` — Toggle enforcement.
- `/task done` — User fallback for task completion.
- `/phase next` — User fallback for phase advancement.
- `/review approve` — User fallback for review approval.

## Source Issue Resolution

| Issue | Resolution |
|---|---|
| #006 Acceptance criteria not extracted | Derived on demand from `spec.md`, never cached |
| #017 [no-test] tasks not detected complete | LLM calls `megapowers_signal({ action: "task_done" })` |
| #019 Task completion not advancing | `task_done` deterministically advances index, writes to disk |
| #021 Task list source of truth | Disk-only state, tool-based signals, no in-memory drift |
| #023 "None" detected as open question | `hasOpenQuestions()` parser fixed for sentinels |
| #024 Review approval not detected | LLM calls `megapowers_signal({ action: "review_approve" })` |
| #028 Artifact/signal disconnect | Eliminated — signals are tool calls, not prose parsing |
| #029 Task state source of truth | Tasks from `plan.md` on demand, progress in `state.json` as `completedTasks[]` |

## Testing Strategy

- **state-io:** Round-trip read/write, missing file, corrupt JSON, atomic writes.
- **write-policy:** Every phase × file type. Pure function, no disk.
- **tool-signal:** Each action against temp fixtures. Verify state on disk after call.
- **tool-overrides:** Phase-based blocking, TDD tracking, mega-off passthrough, satellite mode.
- **gates:** Realistic fixture directories with state + artifacts.
- **parsers:** hasOpenQuestions sentinels, extractAcceptanceCriteria, parsePlanTasks formats.
- **phase-advance:** Full transition chains, backward transitions, gate rejections.

## Out of Scope (Future Work)

### Custom Subagent Architecture
Build a megapowers-specific subagent extension with jj-change-per-task isolation. Primary session creates jj change before spawn, inspects diff after. Failed work rolled back via `jj abandon`. Parallel dispatch via jj's DAG for independent tasks.

**Depends on:** This refactor (disk-first state, tool overrides, write-policy, jj in tool handlers).

### jj-Based Recovery & Verification
TDD verification via `jj diff` (check test files in change). State reconstruction from change tree when state.json is lost. Change-based audit trail.

**Depends on:** This refactor (jj operations in tool handlers).
