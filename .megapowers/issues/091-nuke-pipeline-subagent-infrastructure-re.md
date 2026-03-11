---
id: 91
type: feature
status: in-progress
created: 2026-03-06T02:23:11.064Z
sources: [85, 86]
priority: 1
---
# Nuke pipeline/subagent infrastructure, rely on pi-lcm for context management
## Problem

The current pipeline/subagent infrastructure is fundamentally broken:
- Subagents produce garbage code in isolated worktrees with no real codebase context
- The LLM reviewer step is another hallucination layer reviewing the first hallucination's output
- Auto-squash lands garbage into the working directory with zero human checkpoint
- The orchestrator blindly trusts `status: "completed"` and marks tasks done
- Building subsequent tasks on top of garbage foundations compounds the damage

The entire value proposition of megapowers (structured quality gates, TDD enforcement, human oversight) is bypassed by the pipeline/subagent path.

## Solution

**Delete the entire pipeline/subagent infrastructure.** The primary session does all implement tasks sequentially with full TDD enforcement, tool hooks, and human oversight. Context rot (the original motivation for subagents) is solved by pi-lcm instead.

### What gets removed

**Tools:**
- `pipeline` tool (pipeline-tool.ts)
- `subagent` tool (oneshot-tool.ts)

**Infrastructure:**
- `pipeline-runner.ts` — multi-step implement→verify→review runner
- `pipeline-workspace.ts` — git worktree create/squash/cleanup
- `pipeline-results.ts` — structured result types
- `pipeline-context-bounded.ts` — bounded context rendering
- `pipeline-steps.ts` — step definitions
- `tdd-auditor.ts` — post-hoc TDD compliance check
- `pi-subagents-dispatcher.ts` — pi-subagents wrapper
- `dispatcher.ts` — dispatch interface
- `message-utils.ts` — message parsing utilities
- `satellite.ts` — satellite mode setup (PI_SUBAGENT env detection)

**Tests:**
- All corresponding test files

**State fields:**
- Remove `tddTaskState` pipeline-related fields from state if any
- Clean up any pipeline/subagent references in state-machine transitions

**Prompt references:**
- Remove pipeline/subagent instructions from prompt templates
- Remove satellite mode references from system prompts

### What stays

- TDD enforcement via tool hooks (write/edit interception) — this is the primary session path
- `task_done` signal — still marks current task complete
- `currentTaskIndex` / `completedTasks` state — sequential task progression
- All plan/spec/brainstorm/diagnose phases — unchanged

### Future direction

- **pi-lcm** handles context rot for long multi-task sessions
- **pi-teams** (or similar CC Teams-style coordination) is the path to parallelism when needed — separate initiative

### Closes

- #085 (pipeline squash bug — no more pipeline)
- #086 (subagent reliability — no more subagents)
