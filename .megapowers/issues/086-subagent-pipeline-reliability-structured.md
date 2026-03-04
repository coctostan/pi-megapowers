---
id: 86
type: feature
status: closed
created: 2026-03-03T20:07:00.244Z
sources: [85, 74]
---
# Subagent pipeline reliability & structured handoff
Fix the blocking squash bug (#085) and improve subagent pipeline reliability with structured result handoff (#074).

**#085 — Squash "already exists" bug (P1 blocker)**
Replace `git diff | git apply` with direct file-level copy in `squashPipelineWorkspace`. Current approach fails when worktree creates files that already exist as uncommitted additions in the main working directory.

**#074 — Structured handoff & pipeline hardening**
- Replace fragile regex-based review verdict parsing with structured result types
- Untyped workspace op return types (`squashPipelineWorkspace` / `cleanupPipelineWorkspace` return `{}`, requiring `(x as any).error` casts)
- Pipeline context growth — `renderContextPrompt` appends full step output verbatim across retries
- Subagent results come back as unstructured text blobs; need typed result contracts between pipeline steps
