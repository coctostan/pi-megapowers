---
id: 80
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M6
priority: 3
---

# Clean Context Windows

## Problem

Long sessions accumulate stale context — earlier phases' conversation history, failed approaches, superseded plans. By the time you're in implement phase, the context window is polluted with brainstorm exploration that's no longer relevant. This wastes tokens, confuses the agent, and degrades output quality.

## Proposed Solution

Programmatic session reset at phase boundaries:
- When transitioning to a new phase, start a fresh context window
- Inject only what the new phase needs: current state, relevant artifacts, phase-specific prompt
- Previous conversation available via artifact files, not context window

Implementation via pi SDK's `sendUserMessage` / `newSession` (or equivalent). The extension triggers a new session with a crafted opening message that includes:
1. Phase-specific system prompt
2. Current issue context (title, description, milestone)
3. Relevant artifacts from previous phases (spec.md, plan.md, etc.)
4. Current task context (if in implement phase)

### Selective context carry-forward
Not all phase transitions should reset. Within implement, task-to-task should preserve some context. Rules:
- brainstorm → spec: reset (exploration done, crystallize)
- spec → plan: reset (spec is the artifact, not the conversation)
- plan → review: no reset (reviewer needs to see the plan conversation)
- review → implement: reset (plan is the artifact)
- implement task N → task N+1: soft reset (carry test results, not full conversation)
- implement → verify: no reset (verifier needs implementation context)
- verify → code-review: no reset (reviewer needs both)

## Acceptance Criteria

- [ ] Phase transitions trigger context window management (reset or carry)
- [ ] Reset injects phase-specific prompt + relevant artifacts
- [ ] Configurable per-transition reset policy (reset / carry / soft-reset)
- [ ] Soft reset carries summary, not full conversation
- [ ] Token count drops measurably after reset transitions
- [ ] No loss of critical information (artifacts survive in files)
- [ ] Works with pi SDK session management

## Notes

- Needs pi SDK support for programmatic session creation. Verify this exists before planning.
- The "soft reset" concept (carry summary) may require an LLM call to summarize before resetting.
- This is the most technically dependent M6 feature — may need pi SDK changes.
