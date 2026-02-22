---
id: 2
type: bugfix
status: open
created: 2026-02-22T16:55:00.000Z
---

# Artifact router overwrites artifacts with conversational LLM responses

## Bug Description

The `agent_end` handler in `index.ts` runs `processAgentOutput()` on every assistant message. The artifact router checks only `phase` and `text.length > 100` to decide whether to save an artifact. This means follow-up conversational messages from the LLM (e.g., "The spec has 17 criteria, ready to advance") also get saved as artifacts, **overwriting the real artifacts** that were written moments earlier.

## Observed Impact

During the 001-bugfix-feature issue, both `spec.md` and `plan.md` were overwritten by conversational summary text. The spec lost all 17 acceptance criteria (replaced with a 3-line summary), and the plan lost all 8 tasks (replaced with a table summary).

## Root Cause

`processAgentOutput()` in `artifact-router.ts` has no idempotency guard or structural validation. For example:
- `spec` phase: saves any text > 100 chars. Should require `## Acceptance Criteria` header.
- `plan` phase: saves any text > 100 chars. Should require `### Task` headers.
- `brainstorm` phase: checks for `## Approach` or `## Key Decisions` — this one is slightly better but still loose.

## Suggested Fix

Add structural markers as required conditions before saving artifacts:
- `spec.md`: require `## Acceptance Criteria` heading
- `plan.md`: require `### Task` heading pattern
- `brainstorm.md`: current check is adequate
- `reproduce.md` / `diagnosis.md`: define similar structural markers

Alternatively, track "artifact already saved this phase" in state and don't overwrite.
