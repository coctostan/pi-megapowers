---
id: 22
type: feature
status: done
created: 2026-02-23T15:30:00.000Z
---

# Show artifact filename in notification after each phase

## Problem

After each phase completes and an artifact is saved (spec.md, plan.md, review.md, etc.), the notification says "Spec saved." or "Plan saved." but doesn't include the actual file path. Users can't easily find or review the artifact without knowing the `.megapowers/plans/{slug}/` directory structure.

## Desired Behavior

Notifications should include the full relative path, e.g.:
- "Spec saved → .megapowers/plans/016-batch-bugfixes-issues/spec.md"
- "Plan saved. 9 tasks extracted. → .megapowers/plans/016-batch-bugfixes-issues/plan.md"

This is a **feature** (UX improvement) — not a bug, since artifacts are correctly saved today.
