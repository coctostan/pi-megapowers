---
id: 6
type: bugfix
status: open
created: 2026-02-22T17:00:00.000Z
---

# Acceptance criteria not extracted after spec phase

When the spec phase completes and the spec contains an `## Acceptance Criteria` section with numbered items, the criteria are not being extracted into `state.acceptanceCriteria`. The state remains empty. This means the verify phase has nothing to check against, and the implement phase can't track coverage.

Possibly related to the artifact router not triggering extraction, or the spec content not matching the expected heading format.
