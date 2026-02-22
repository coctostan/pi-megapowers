---
id: 11
type: feature
status: open
created: 2026-02-22T17:00:00.000Z
---

# All work happens on main branch — should it create feature branches?

Currently megapowers does all work directly on main. There's jj integration for change tracking per issue/phase, but no git/jj branch creation. 

Should the extension automatically create a branch (e.g. `feat/{issue-slug}` or `fix/{issue-slug}`) when an issue starts, and prompt for PR/merge when it reaches done? This would align with standard git workflows and prevent polluting main with WIP commits.

Considerations:
- jj vs git branching semantics differ
- Some users may want trunk-based development
- Could be a config option: `branching: "auto" | "manual" | "none"`
