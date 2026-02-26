# Phase 7: Issues — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"What are the concrete units of work?"**

The roadmap defines milestones. This phase decomposes milestones into issues — the units that enter the dev workflow (feature/bugfix). Each issue is specific enough to brainstorm, spec, plan, implement, and verify.

## Process Is The Same for Brownfield and Greenfield

Both have a roadmap with milestones. Both need issues. Brownfield will have more issues because it inherits existing bugs and tech debt. Greenfield issues are purely forward-looking.

---

## The Process

### Step 1: Inventory Existing Issues (Brownfield Only)

For brownfield, issues likely already exist — bug reports, feature requests, TODOs. Gather them:

1. Read every issue in the backlog
2. Note which roadmap milestone each naturally maps to
3. Flag stale issues (superseded by other issues, already fixed, no longer relevant)

For megapowers, 17 issues existed from prior triage sessions. Some were batch issues grouping smaller source issues. Some were stale (source issues superseded by newer, more specific issues).

### Step 2: Create the Milestones File

Before mapping issues, create the tracking layer. A milestones file serves as the bridge between the roadmap (planning) and the issues (execution).

**Location:** `.megapowers/milestones.md`
**Contents per milestone:**
- Status (not started / in progress / done)
- Theme (one line from roadmap)
- Gate (from roadmap)
- Issues table: ID, title, priority, status
- Dependency chains between issues
- Foldable gaps (small gaps that existing issues can absorb)

This is the operational document. The roadmap stays as the design document. Don't duplicate — cross-reference.

### Step 3: Map Existing Issues to Milestones

For each existing issue, assign:
- **`milestone: MX`** in frontmatter — which milestone it belongs to
- **`priority: N`** in frontmatter — relative priority within the milestone (1 = highest)

Priority within a milestone reflects: blocking bugs first, then prerequisites, then features, then polish.

### Step 4: Identify Gaps

Walk each roadmap milestone's steps. For each step, ask: "Is there an issue that covers this?" Three outcomes:

1. **Covered** — an issue exists, maps to this step. Done.
2. **Foldable** — the gap is small enough to absorb into an existing issue. Note it in milestones.md as a foldable gap and consider expanding the existing issue's AC later.
3. **Needs new issue** — the gap is substantial. Create an issue.

For megapowers: 17 existing issues, 23 gaps found. 6 were foldable into existing issues. 14 needed new issues. After batching related gaps, 11 new issues were created (070–080).

### Step 5: Write Gap Issues

For each gap that needs an issue:

1. **Consider batching** — related gaps within the same milestone can be one issue if they share implementation. Don't create 14 issues when 11 cover the same ground more naturally.
2. **Write the issue** using the conventions format: frontmatter (id, type, status, created, milestone, priority) + Problem + Proposed Solution + Acceptance Criteria + Notes.
3. **Include dependency notes** — which issues must be done first, which issues this enables.

**Issue quality bar:** A fresh agent should be able to read the issue and enter the brainstorm phase without asking "what does this mean?" The problem should be concrete, the proposed solution should be directional (not prescriptive — planning happens later), and the ACs should be testable.

### Step 6: Update the Milestones File

Add new issues to the milestones file. Update counts, dependency chains, and gap status. The milestones file should now be the complete picture — every roadmap step either has an issue or is noted as a foldable gap.

### Step 7: Archive Stale Issues (Brownfield Only)

Move superseded, fixed, or irrelevant issues to `issues/archive/`. Update frontmatter: `status: archived`, add `archived: <date>` and `archive-reason: <reason>`.

---

## What We Learned

### The milestones file was the missing layer
The roadmap defines milestones. Issues define work. Nothing connected them. Issue frontmatter tags (`milestone: M2`) provide bottom-up lookup. The milestones file provides top-down lookup. You need both directions.

### Gap analysis is the real value
Mapping existing issues is mechanical. The insight comes from walking the roadmap and finding what's NOT covered. For megapowers, the gap count (23) exceeded the existing issue count (17). Without this phase, the project would have started dev workflows with half the work invisible.

### Batch gaps thoughtfully
14 gaps ≠ 14 issues. Related gaps within the same milestone often share implementation. The M6 init system had 6 gaps that became 3 issues. M2 subagent pipeline had 3 gaps that stayed 3 issues (genuinely separate concerns). Judgment call — err on the side of fewer, larger issues over many tiny ones.

### Priority is per-milestone, not global
A P1 in M5 is less urgent than a P3 in M0. Milestone ordering provides the global sequence. Priority within a milestone provides the local sequence. Don't try to create a single global priority ranking — it's false precision.

### Brownfield issues accumulate cruft
Existing issues reference old assumptions, superseded designs, or problems that evolved. The mapping phase is a natural time to flag stale issues for archiving. Don't just map — also prune.

---

## Gate

Issues phase is done when:
- Every roadmap milestone step maps to an issue or is noted as a foldable gap
- All issues have `milestone` and `priority` in frontmatter
- Milestones file exists with complete issue tables and dependency chains
- Stale issues identified and flagged (archived or noted for archival)
- A fresh agent can read milestones.md and know what to work on next
