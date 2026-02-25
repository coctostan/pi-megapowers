# Handoff: Prompt Audit & Improvement (Issue #062)

## What We're Doing

Working on issue #062 (prompt/skill markdown audit) **outside the megapowers workflow** — direct editing, no phase gates.

## State of Things

- **Git**: clean, on `main`, pushed. No stale branches.
- **Megapowers state**: cleared — no active issue, no phase.
- **Cleanup done this session**: archived 52 done issues, pared AGENTS.md (104→43 lines), created fresh ROADMAP.md, closed source issues superseded by batches.

## Prompt Comparison: megapowers vs superpowers

We started comparing prompts 1-by-1 against pi-superpowers equivalents (skills). Completed **#1 — brainstorm.md** before pausing.

### Mapping table

| # | Megapowers Prompt | Superpowers Equivalent |
|---|---|---|
| 1 | `prompts/brainstorm.md` | `skills/brainstorming/SKILL.md` |
| 2 | `prompts/write-spec.md` | (none) |
| 3 | `prompts/write-plan.md` | `skills/writing-plans/SKILL.md` |
| 4 | `prompts/review-plan.md` | (none) |
| 5 | `prompts/implement-task.md` | `skills/executing-plans/SKILL.md` + `skills/test-driven-development/SKILL.md` |
| 6 | `prompts/verify.md` | `skills/verification-before-completion/SKILL.md` |
| 7 | `prompts/code-review.md` | `skills/requesting-code-review/SKILL.md` |
| 8 | `prompts/reproduce-bug.md` | `skills/systematic-debugging/SKILL.md` |
| 9 | `prompts/diagnose-bug.md` | (same debugging skill) |
| 10-14 | done-phase prompts (learnings, changelog, docs, bugfix-summary, triage) | (none) |
| 15 | `prompts/megapowers-protocol.md` | (none — different arch) |

Superpowers equivalents live at:
- `/Users/maxwellnewman/pi/workspace/pi-superpowers/skills/`
- `/Users/maxwellnewman/pi/workspace/pi-superpowers-plus/skills/` (same + extra reference docs)

### Brainstorm comparison findings

**Superpowers does better:** cross-references to related phases, explicit "after brainstorming" next-steps section.

**Megapowers does better:** injects project learnings + roadmap context via template vars, "check if already solved", structured output template (Approach/Key Decisions/Components/Testing Strategy), explicit "design for testability".

**Both share:** one question at a time, multiple choice preferred, 200-300 word sections, 2-3 approaches with trade-offs, YAGNI.

## Next Steps

1. **Add version control guidance** to the start of brainstorm.md (jj-based, not worktrees like superpowers)
2. Continue prompt-by-prompt (#2 write-spec.md through #15), comparing and improving each
3. Each prompt: read megapowers version, read superpowers equivalent, identify gaps, draft improvement
