---
id: 53
type: bugfix
status: open
created: 2026-02-24T19:25:00.000Z
---

# `/issue new` should trigger LLM-assisted issue creation, not manual UI prompts

## Problem

The `/issue new` command currently presents a series of TUI text prompts asking the user to manually type a title, select a type, and write a description. This is the wrong UX — the user has to context-switch from conversing with the agent to filling out form fields. The agent, which has full conversation context and understands the project, isn't involved at all.

## Expected Behavior

`/issue new` should hand off to the LLM to draft the issue collaboratively:

1. User says `/issue new` (or describes a bug/feature in conversation)
2. The LLM asks clarifying questions, proposes a title, type, and description
3. The LLM calls `create_issue` tool (see #046) to persist it
4. User can refine through conversation before the issue is finalized

The agent already has the project context, conversation history, and megapowers awareness to write a well-structured issue. Making the user type it into a dumb form wastes all of that.

## Related

- #046 — `create_issue` tool (prerequisite — the LLM needs a tool to call)
- #048 — LLM needs megapowers context even without active issue (so it knows it can create issues)
