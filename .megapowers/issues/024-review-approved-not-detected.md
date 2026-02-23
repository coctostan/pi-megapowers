---
id: 24
type: bugfix
status: open
created: 2026-02-23T15:30:00.000Z
---

# Review phase says plan not approved when it is approved

## Problem

During review phase, the gate check reports "Cannot advance: Plan review not approved yet" even when the LLM has approved the plan. The `reviewApproved` flag in state remains `false`.

## Root Cause

The artifact router at `artifact-router.ts:79-80` detects approval via regex:
```
/\b(verdict|status)\b[:\s]*(pass|approved)/i
```

This requires the LLM output to contain exact patterns like "Verdict: approved" or "Status: pass". If the LLM writes approval in a different format (e.g., "I approve this plan", "Plan looks good, approved", "LGTM"), the regex doesn't match and `reviewApproved` is never set to `true`.

## Expected Behavior

The review approval detection should be more robust. Options:
1. Broaden the regex to catch common approval patterns ("approved", "LGTM", "looks good")
2. Add a structural marker the prompt instructs the LLM to use (e.g., `<!-- APPROVED -->`)
3. Add a `/review approve` command as a manual fallback when regex detection fails (similar to issue #021's `/task done` proposal)
