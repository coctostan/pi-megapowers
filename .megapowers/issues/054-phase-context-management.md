---
id: 54
type: feature
status: open
created: 2026-02-24T19:25:00.000Z
---

# Active context management per phase with context clearing between transitions

## Problem

Megapowers phases accumulate context without boundaries. By the time the agent reaches implement, the conversation is bloated with brainstorm exploration, spec drafts, plan revisions, and review feedback — most of which is irrelevant to the current task. This wastes tokens, degrades response quality, and causes the agent to reference stale decisions. There's no mechanism to clear context between phases or to actively manage what's in scope during a phase.

## Desired Behavior

### Phase transition context clearing

When advancing to a new phase, the conversation context should be reset or trimmed. The relevant output from the previous phase is already persisted as artifacts (`spec.md`, `plan.md`, etc.) — those artifacts become the input for the next phase, not the raw conversation history.

- **brainstorm → spec**: Clear brainstorm conversation. Spec phase loads `brainstorm.md` as input.
- **spec → plan**: Clear spec conversation. Plan phase loads `spec.md` as input.
- **plan → review → implement**: Clear planning conversation. Implement loads `plan.md` + task list.
- **task_done → next task**: Clear previous task's implementation conversation. Load next task's plan section.

### Active context management during implement

Implementation phase is the most context-hungry and needs the most aggressive management:

- **Per-task scoping**: Each task should start with only its plan section, relevant file contents, and test expectations — not the entire plan or previous tasks' conversations.
- **File context budget**: Actively manage which files are in context. Drop files that aren't relevant to the current task.
- **Completed task pruning**: Once a task is marked done, its implementation conversation should not carry forward to the next task.
- **Error context**: When debugging a failing test, keep the error and relevant code but prune unrelated context.

### Cross-phase context preservation

Some things should survive phase transitions:
- **Learnings** — always available (already stored in `.megapowers/learnings.md`)
- **Architecture decisions** — from spec/plan phases, relevant during implement
- **Key constraints** — non-functional requirements that affect all tasks

## Context

- Pi supports conversation management but megapowers doesn't use it for phase transitions
- The `before_agent_start` hook injects phase-specific prompts but doesn't manage existing context
- Artifact files already persist phase outputs — the conversation is redundant after transition
- Subagents (#032) naturally get clean context per task, but the primary session doesn't

## Open Questions

- Does pi's SDK support clearing/resetting conversation history programmatically?
- Should context clearing be automatic on phase transition or opt-in?
- What's the right granularity for implement — per task, per test-cycle, or per file?
