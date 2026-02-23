---
id: 23
type: bugfix
status: open
created: 2026-02-23T15:30:00.000Z
---

# Spec parser detects "None" under Open Questions as an open question

## Problem

`hasOpenQuestions()` in `spec-parser.ts` checks for any non-empty line under the `## Open Questions` heading. When the LLM writes "None", "N/A", "No open questions", or similar, the parser treats it as an unresolved question and blocks the spec→plan gate.

## Root Cause

The function at `spec-parser.ts:52-68` uses a simple `line.trim().length > 0` check — it doesn't recognize common "empty" sentinel values.

## Expected Behavior

Lines containing only "None", "N/A", "No open questions", "(none)", or similar should not count as open questions. The gate should only block when there are actual question items (e.g., lines starting with `- ` or `1. `).
