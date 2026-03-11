---
id: 79
type: feature
status: archived
created: 2026-02-25T18:50:00.000Z
archived: 2026-03-11T17:02:47Z
milestone: M6
priority: 2
---

# Foundation Doc Lifecycle

## Problem

Foundation docs (vision, PRD, architecture, roadmap, conventions) are created during init and then forgotten. They drift from reality as the project evolves. The dev workflow doesn't read them, doesn't update them, and doesn't flag when they're stale.

## Proposed Solution

### Read: inject during brainstorm
When a feature/bugfix enters brainstorm phase, automatically load relevant foundation docs into context:
- Vision → for understanding project direction
- PRD → for user stories and priorities
- Architecture → for technical constraints and patterns
- Conventions → for code style and process rules

Injection via prompt template expansion, not manual user action. Configurable which docs load (not all are relevant for every issue).

### Update: propose during done
When an issue completes (done phase), analyze what changed and propose updates to foundation docs:
- New architectural patterns introduced → update architecture
- New conventions established → update conventions
- Roadmap milestones completed → update roadmap
- PRD priorities shifted → flag for review

Updates are proposed, not auto-applied. User approves each update.

### Audit: on-demand review
`/mp audit` — analyze foundation docs against current codebase state, flag drift:
- Architecture doc says X but code does Y
- Convention doc says Z but no code follows it
- Roadmap milestone M2 marked incomplete but all issues are done

`/mp revisit <doc>` — re-run the init phase for one specific doc (e.g., re-do architecture analysis with current codebase).

## Acceptance Criteria

- [ ] Brainstorm phase loads relevant foundation docs into prompt context
- [ ] Configurable which docs load per workflow/issue
- [ ] Done phase analyzes changes and proposes foundation doc updates
- [ ] Proposed updates shown to user for approval (not auto-applied)
- [ ] `/mp audit` scans foundation docs for drift, produces report
- [ ] `/mp revisit <doc>` re-runs single init phase for one doc
- [ ] Foundation doc locations configurable (default: `.megapowers/init/<project>/`)

## Notes

- The "read" part is high-value and low-effort — just prompt template expansion.
- The "update" part is medium-effort — needs diffing logic and approval UI.
- The "audit" part is the most complex — needs codebase analysis. Could be a subagent task.
- `/mp audit` could reuse the init-brownfield audit phase template.
