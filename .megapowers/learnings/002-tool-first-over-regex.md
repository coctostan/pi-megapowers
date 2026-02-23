# Learning: Tool-first signals beat regex detection

## Context
Issues #006, #017, #019, #021, #024, #028, #029 all traced back to regex-based detection of LLM output for state transitions (task completion, review approval, artifact persistence).

## Problem
The original architecture relied on `artifact-router.ts` scanning assistant prose with patterns like `/task\s+(?:complete|done|finished)/i`. This failed constantly because:
- LLMs don't reliably produce exact phrases, even when prompted
- Detection was passive (fire-on-every-message) rather than explicit
- Silent failures left the state machine stuck with no error or diagnostic

## Solution
Replace regex detection with structured tool calls (`megapowers_signal`, `megapowers_save_artifact`). The LLM calls a tool to signal completion — it either works or returns an actionable error.

## Key insight
**Structured tools are the right interface between LLMs and state machines.** Regex on prose is inherently fragile because LLM output is non-deterministic. Tool calls are deterministic — the LLM either calls the tool or doesn't. When prompted correctly ("call `megapowers_signal` with action `task_done`"), compliance is near-100%.

## Corollary
This also means prompts should give **exact tool call syntax**, not abstract instructions. "Signal task completion" is ambiguous; "call `megapowers_signal({ action: 'task_done' })`" is unambiguous.
