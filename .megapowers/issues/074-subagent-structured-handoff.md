---
id: 74
type: feature
status: closed
created: 2026-02-25T18:50:00.000Z
sources: [75]
milestone: M2
priority: 2
---

# Subagent Structured Handoff & Rich UI

## Problem

1. **Unstructured results** — Subagent results come back as text blobs. The parent agent parses free-text to determine what happened — fragile and lossy.
2. **No visibility** — When a subagent runs, the user sees almost nothing. No agent name, model, task, duration, cost, tool calls, or files changed.

## Proposed Solution

### Structured result format
```typescript
type SubagentResult = {
  status: 'success' | 'partial' | 'failed';
  filesChanged: string[];
  testsRun: { passed: number; failed: number; skipped: number };
  testOutput?: string;
  issues: string[];
  summary: string;
};
```

### Rich UI panel
Subagent display panel showing: agent name + model, task description, live status, duration + token count + estimated cost, tool calls, files changed.

## Acceptance Criteria

- [ ] SubagentResult type defined
- [ ] Subagent prompt instructs writing result JSON on completion
- [ ] subagent_status returns structured result
- [ ] Parent agent makes decisions based on structured fields
- [ ] Graceful fallback when result JSON is missing
- [ ] Subagent panel shows agent name, model, task when delegation starts
- [ ] Live status updates (running/done/failed)
- [ ] Duration, token count, and tool call count visible
- [ ] Files changed visible on completion

## Notes
- Absorbs #075 (rich subagent UI).
- Enables per-task chain decisions based on structured results.
