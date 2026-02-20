# 05: Distributed Task Coordination Design

## Overview

Coordination layer for tracking task execution during the implement phase, regardless of whether work is done inline or via subagent delegation. Uses jj as the coordination mechanism — per-task changes provide artifact discovery, completion detection, rollback, and audit trail.

Megapowers is subagent-controller agnostic. It does not spawn, manage, or depend on any specific subagent tool. The LLM decides whether to work inline or delegate, guided by the implement phase prompt.

## Core Model

**Parent session is the sole coordinator.** It creates jj changes, updates megapowers state, and inspects results. Subagent sessions (if any) are workers — they write files but don't manage coordination state.

**jj is the source of truth for task execution.** Each task gets its own jj change. Completion, artifact discovery, and rollback are all jj operations.

## Task Lifecycle

### Sequential Flow (Current Phase)

1. **Setup** — Parent creates a jj change for the task:
   ```
   jj new -m "mega(issue-slug): task-3 — Add retry logic"
   ```
   Change is parented off the implement phase change. Change ID is recorded in megapowers state against the task.

2. **Execution** — The LLM implements the task. It may:
   - Work inline in the current session
   - Delegate to a subagent via whatever subagent tool is available
   - The implement phase prompt guides this decision

3. **TDD enforcement** — tdd-guard runs in the current session (inline) or in satellite mode (subagent). Either way, the task's TDD state machine is enforced.

4. **Inspection** — When the LLM signals the task is done (or the subagent returns), the parent inspects the jj change:
   - `jj diff -r <change-id>` — what files were modified (artifact discovery)
   - `jj log -r <change-id>` — change metadata
   - If no diffs exist, the task didn't produce output — flag for review

5. **Completion** — Parent marks the task complete in megapowers state, advances to the next task, creates a new jj change.

6. **Rollback** — If a task went wrong: `jj abandon <change-id>`. Clean slate, no file cleanup needed.

### Future: Parallel Execution

Parallel subagent execution is not in scope for this phase but the design does not block it. The natural extension path is **jj workspaces** — each parallel subagent gets its own workspace (separate working copy) with its own change. Parent merges changes when all tasks complete.

## Satellite Mode

When megapowers loads in a subagent session, it detects the subagent context and runs in a restricted mode.

### Detection

A session is a subagent if any of:
- No TTY attached (`!process.stdout.isTTY`)
- Running in JSON mode (`--mode json`)
- Environment signal (e.g., `PI_SUBAGENT=1` — set by most subagent tools)

### Behavior

| Capability | Primary Session | Satellite Mode |
|------------|----------------|----------------|
| Read `.megapowers/state.json` | ✅ Read/write | ✅ Read-only |
| TDD enforcement (`before_tool_call`) | ✅ Full | ✅ Full |
| Dashboard rendering | ✅ | ❌ |
| Command registration (`/phase`, `/done`, etc.) | ✅ | ❌ |
| Prompt injection | ✅ | ❌ |
| State file writes | ✅ | ❌ |
| jj change management | ✅ | ❌ |

Satellite mode ensures subagent sessions get TDD enforcement without interfering with the primary session's coordination role.

## jj Change Structure

During the implement phase, the jj DAG looks like:

```
main
└── mega(auth-flow): implement          ← phase-level change
    ├── mega(auth-flow): task-1 — Define types [no-test]
    ├── mega(auth-flow): task-2 — Add auth middleware
    ├── mega(auth-flow): task-3 — Add retry logic
    └── mega(auth-flow): task-4 — Wire routes     ← current
```

Each task change is a child of the phase change. On phase completion, task changes can be squashed into the phase change or kept granular — user's choice (surfaced in the done phase menu).

## Implement Phase Prompt

The implement phase prompt is the mechanism that guides subagent usage. It tells the LLM:

- The current task and its requirements
- That it can work inline or delegate to a subagent
- That TDD is enforced regardless of execution method
- To signal when the task is complete so megapowers can inspect and advance

The prompt does not prescribe a specific subagent tool. The LLM uses whatever tool is available in the session.

## Components

### New Module: `task-coordinator.ts`

- `createTaskChange(jj, issueSlug, taskName)` → change ID
- `inspectTaskChange(jj, changeId)` → `{ files: string[], hasDiffs: boolean }`
- `abandonTaskChange(jj, changeId)` → void
- `squashTaskChanges(jj, phaseChangeId)` → void

### New Module: `satellite.ts`

- `isSatelliteMode()` → boolean (detects subagent context)
- `loadSatelliteState(stateFile)` → read-only state snapshot
- Wiring: when satellite mode detected, register only tdd-guard's `before_tool_call` hook

### Modifications

- **`index.ts`** — On activation, check `isSatelliteMode()`. If true, wire satellite-only hooks and return early. If false, wire full primary session.
- **`ui.ts`** — Done phase menu: option to squash task changes or keep granular
- **`store.ts`** — Track jj change ID per task
- **`prompts/implement-task.md`** — Add guidance on inline vs. subagent delegation

## Non-Goals

- Parallel subagent execution (future phase, via jj workspaces)
- Coupling to any specific subagent tool
- Subagent spawning or lifecycle management
- Circuit breaker / token monitoring (separate concern if needed later)
