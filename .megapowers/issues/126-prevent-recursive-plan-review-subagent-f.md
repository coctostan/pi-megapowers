---
id: 126
type: bugfix
status: open
created: 2026-03-12T16:47:43.933Z
---
# Prevent recursive plan-review subagent fan-out
Focused plan-review advisory subagents recursively trigger the same plan-review fan-out and receive the primary review prompt, causing infinite subagent spawning and making advisory reviewers behave like the main reviewer. Fix by detecting subagent sessions, skipping focused-review fan-out inside them, and injecting advisory-only review guidance instead of the primary review-plan prompt.
