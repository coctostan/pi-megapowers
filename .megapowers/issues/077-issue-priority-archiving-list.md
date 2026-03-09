---
id: 77
type: feature
status: done
created: 2026-02-25T18:50:00.000Z
milestone: M5
priority: 3
---

# Issue Priority, Archiving, and List UI

## Problem

Issues have no priority sorting in the list view. Archiving is manual (move file to archive/). The `/mp issues` display is a flat list with no grouping, no milestone context, no priority ordering. As the backlog grows past 20 issues, this becomes unusable.

## Proposed Solution

### Priority sorting
`/mp issues` sorts by: milestone (M0 first) → priority (1 first) → created date.

### Archiving
`/mp archive <id>` moves issue to archive/, sets `status: archived`, adds `archived: <date>` to frontmatter. `/mp issues --archived` shows archived issues.

### List UI improvements
```
M0: Restructure (1 issue)
  #070 [P1] Directory restructure               open
M1: UX Foundation (6 issues)
  #061 [P1] jj mismatch dialog frozen           open
  #050 [P1] Agent context & awareness            in-progress
  ...
```

Group by milestone, show priority badge, status, truncated title.

### Triage
`/mp triage` — interactive reprioritization. Shows issues, lets user reorder within milestone.

## Acceptance Criteria

- [ ] `/mp issues` groups by milestone, sorts by priority
- [ ] Priority badge shown per issue ([P1], [P2], etc.)
- [ ] `/mp archive <id>` moves issue to archive with metadata
- [ ] `/mp issues --archived` shows archived issues
- [ ] `/mp triage` allows interactive reprioritization
- [ ] Milestone summary line shows issue count and status breakdown

## Notes

- #058 covers issue creation UX. This covers the other side — viewing, sorting, archiving.
- Triage could be deferred to a later pass if the list UI + archiving are enough.
