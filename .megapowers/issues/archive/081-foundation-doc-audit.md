---
id: 81
type: feature
status: done
created: 2026-02-25T19:15:00.000Z
milestone: M6
priority: 1
---

# Foundation Doc Audit

## Problem

The 8 brownfield process templates and 8 project deliverables were written across multiple sessions. Information may be in the wrong place (architecture details in the PRD, convention details in the roadmap), gaps may exist between phases, and later phases may have introduced concepts that earlier phases should reference.

No systematic review has been done to check cross-document consistency.

## Proposed Solution

Review all init docs for:

1. **Misplaced content** — information that belongs in a different phase doc
2. **Gaps** — things referenced but never defined, or phases that don't connect
3. **Redundancy** — same information repeated across docs (fine for cross-references, bad for divergent copies)
4. **Stale references** — early docs referencing things that later phases renamed or restructured
5. **Completeness** — each process template should be self-contained enough for a fresh agent to execute it

### Documents to review

**Process templates** (`init/process/`):
00-audit, 01-discovery, 02-vision, 03-prd, 04-architecture, 05-roadmap, 06-conventions, 07-issues

**Project deliverables** (`init/megapowers/`):
00-audit, 01-discovery, 02-vision, 03-prd, 04-architecture (current + proposed), 05-roadmap, 06-conventions, 07-issues

**Supporting docs:**
milestones.md, TESTING.md, IMPLEMENTATION.md, AGENTS.md

## Acceptance Criteria

- [ ] Every process template reviewed for misplaced content, gaps, redundancy
- [ ] Every project deliverable reviewed for consistency with its process template
- [ ] Cross-references between docs verified (no broken references)
- [ ] Issues found logged and fixed in-place
- [ ] Audit findings documented (what was moved, what was added, what was removed)

## Notes

- This is a prerequisite for #082 (greenfield variants) — clean brownfield templates before deriving greenfield ones.
- This is a prerequisite for #078 (init workflow system) — the engine needs correct templates.
- This is documentation/content work, not code. But the templates ARE the product for the init system.
