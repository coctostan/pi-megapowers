---
id: 28
type: bugfix
status: done
created: 2026-02-23T15:45:00.000Z
---

# Artifact and signal disconnect between prompts and runtime

There is a disconnect between how the LLM is prompted to write artifacts (specs, plans, task completion signals, open questions sections) and how the runtime processes them. Examples:

- `hasOpenQuestions` parser treats "None." as an open question because it checks for any non-empty line
- Task completion detection relies on fragile regex (`/task\s+(?:complete|done|finished)/`) that the LLM doesn't reliably produce
- The spec prompt tells the LLM to write "None" in Open Questions but the gate rejects it
- Phase transition signals depend on LLM output matching exact patterns

Either the prompts need rigid formatting instructions that exactly match what the parsers expect, or the parsers need to be loosened to handle natural LLM output (e.g., "None", "N/A", "No open questions"). The current middle ground — loose prompts with rigid parsers — creates friction at every phase gate.
