---
id: 74
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M2
priority: 2
---

# Subagent Structured Result Handoff

## Problem

Subagent results come back as unstructured text blobs via `subagent_status`. The parent agent has to parse free-text to figure out what happened — which files changed, whether tests passed, what issues were found. This is fragile and loses information.

## Proposed Solution

Define a structured result format that subagents produce:

```typescript
type SubagentResult = {
  status: 'success' | 'partial' | 'failed';
  filesChanged: string[];
  testsRun: { passed: number; failed: number; skipped: number };
  testOutput?: string;  // truncated
  issues: string[];     // problems encountered
  summary: string;      // human-readable summary
};
```

The subagent writes this as JSON to a known location in its workspace. The squash operation (#067) brings it back. `subagent_status` parses and returns it.

## Acceptance Criteria

- [ ] SubagentResult type defined
- [ ] Subagent prompt instructs writing result JSON on completion
- [ ] subagent_status returns structured result (files, tests, issues, status)
- [ ] Parent agent can make decisions based on structured fields (not text parsing)
- [ ] Graceful fallback when result JSON is missing (legacy behavior)

## Notes

- Depends on #067 (squash fix) — results need to survive workspace squash.
- Enables #076 (per-task chain) — chain decisions need structured results.
- Enables #075 (rich subagent UI) — UI needs structured data to display.
