# Phase 0: Audit — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"What do we have?"** before deciding what to build.

This is the brownfield entry point. You can't write a vision or PRD for an existing project without first understanding what exists, what works, what's broken, and what's missing.

## The Seven Sections

We found that a complete brownfield audit covers exactly seven areas. Less than this and you'll have blind spots when you hit Discovery.

### 1. Codebase Health
- **Size & structure:** File count, LOC, directory layout, entry points
- **Tests:** Run them. Count pass/fail. Categorize failures (real bugs vs stale tests vs flaky). Note test-to-source ratio.
- **Debt markers:** grep for TODO, FIXME, HACK, XXX. Count them. Zero is a signal too.
- **Dead code:** Exported functions with no callers outside their own module + test. These are unfinished intentions.
- **Coverage:** Is tooling configured? If not, note that as a gap.

**What we learned:** Running the tests yourself is non-negotiable. The prior audit said "3 failing tests" — actually running them revealed they're all template expectation mismatches (tests are stale, not code). That distinction matters.

### 2. Architecture
- **Module map by responsibility:** Group files by what they do, not alphabetically. This reveals the actual architecture.
- **Dependency shape:** What imports what? Is there a hub file? Are modules well-decomposed or spaghetti?
- **State flow:** Where does state live? How does it move? Mutable or immutable?
- **Key architectural decisions:** What patterns were chosen intentionally? (These become constraints for the roadmap.)

**What we learned:** Grouping by responsibility (Core State Machine, Enforcement, Subagent System, etc.) made the architecture legible in a way a flat file list doesn't. The "god file" problem only became obvious when you see one module touching 22 of 29 others.

### 3. Documentation State
- **Catalog everything:** Every .md file, where it lives, whether it's current/stale/archive
- **Identify gaps:** What documentation doesn't exist that should?

**What we learned:** A table format (Document | Location | Status) works well. "Stale" is a more useful label than "outdated" — it implies the doc was once correct, not that it was always wrong.

### 4. Feature Completeness
Use four buckets:
- ✅ **Works** — fully functional end-to-end
- ⚠️ **Half-built** — code exists but isn't wired, or works partially
- ❌ **Broken** — exists and fails
- 🚫 **Doesn't exist** — identified as needed but not started

**What we learned:** The half-built category is the most important one. Dead code + exported-but-uncalled functions are half-built features. They're the gap between intention and execution. They're also the biggest risk — new contributors will assume they work.

### 5. User Experience
Walk the actual user path:
- First-time user: what happens from install to first productive use?
- Power user: what's the daily workflow?
- Pain points: where does it break down, frustrate, or dead-end?

**What we learned:** Do this even if the project has no formal UX. Every tool has a user experience. "Must manually create a file with correct frontmatter format" is a UX finding. "The last phase of the workflow is the weakest" is a UX finding.

### 6. Prior Art & Existing Feedback
- Issue backlog (open/closed counts, categories)
- Any previous reviews, audits, feedback sessions
- Unfiled items — things people know about but haven't written down

**What we learned:** This section bridges the audit with what came before. Don't redo work — catalog it and assess its completeness. Our council review was valuable input but wasn't a substitute for systematic analysis.

### 7. Summary
- Strengths (what to build on)
- Weaknesses (what to fix or rethink)
- One-sentence assessment

**What we learned:** Force yourself to write one sentence. If you can't summarize the state of the project in one sentence, you don't understand it yet.

---

## How Long Should This Take?

For megapowers (~4K LOC, 30 modules): about 1 hour of systematic analysis.

Scale roughly with codebase size, but the documentation catalog and UX walkthrough take the same time regardless of LOC.

## Gate

Audit is done when:
- All seven sections have findings (not blanks)
- Tests have been run (not just described from memory)
- Dead code has been identified (not just suspected)
- At least one UX pain point has been articulated
- The one-sentence summary exists

## What Comes Next

Discovery uses the audit as its foundation. Specifically:
- **Strengths** inform what the product can credibly promise
- **Weaknesses** inform what needs to be true before launch
- **UX pain points** inform who the customer is and what problem they have
- **Half-built features** inform the gap between current state and vision
