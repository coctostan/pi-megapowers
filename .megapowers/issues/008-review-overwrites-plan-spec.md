---
id: 8
type: bugfix
status: open
created: 2026-02-22T17:00:00.000Z
---

# Review phase claims plan and spec are corrupted, overwrites them

During the review phase, the LLM reported that the plan and spec were "corrupted" and proceeded to overwrite them with new content. This is catastrophic — review should be read-only for existing artifacts. 

Likely cause: the artifact router is saving LLM output during the review phase as plan.md/spec.md, or the LLM is using write/edit tools to modify those files and the TDD guard doesn't block writes during review phase.

This may be a duplicate or related to issue 002 (artifact overwrite bug).
