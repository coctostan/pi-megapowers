---
id: 111
type: bugfix
status: open
created: 2026-03-07T15:16:23.183Z
sources: [101]
---
# Plan review recovery — remove T1 dead code
Implements the second recovery slice from the overall design in `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`. After T1 is no longer active at runtime, this batch removes the leftover T1 module, prompt, and tests, and replaces them with simpler transition coverage. Goal: cleanup after behavior is already corrected, keeping the diff narrow and deletion-focused.
