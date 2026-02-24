---
id: 57
type: bugfix
status: open
created: 2026-02-24T19:45:00.000Z
---

# Subagent fails silently when jj is not installed — need install check and guidance

## Problem

When a user tries to use the `subagent` tool on a project without jj installed, it errors with a vague message about not being a jj repository. There's no upfront check at session start, no install guidance, and no clear path forward. The user has to figure out on their own that jj is a hard dependency for subagents.

## Reproduction

1. Open a project that uses git (no jj)
2. Start megapowers, select an issue, reach implement phase
3. Agent calls `subagent` tool
4. Error: "jj is required for subagent workspace isolation. This does not appear to be a jj repository."
5. User is stuck — no guidance on how to install jj or initialize it

## Expected Behavior

### Session start check
On `session_start`, detect whether jj is installed (`which jj` or `jj version`) and whether the project is a jj repo. Surface this clearly:
- If jj is not installed: warn with install instructions (`brew install jj`, `cargo install jj-cli`, etc.)
- If jj is installed but repo isn't initialized: suggest `jj git init --colocate` for existing git repos
- If jj is ready: no message needed

### Graceful degradation
When jj isn't available, megapowers should still work for everything except subagents. The warning should be informational, not blocking. The `subagent` tool error message should include install/setup instructions rather than just saying "not a jj repository."

### Documentation
The README or onboarding should list jj as a prerequisite for subagent features, with setup steps for common platforms.

## Context

- jj is required only for subagent workspace isolation — all other megapowers features work without it
- `jj git init --colocate` lets jj work alongside an existing git repo with zero disruption
- The `isJJRepo()` check exists but only fires at subagent dispatch time, not at session start
