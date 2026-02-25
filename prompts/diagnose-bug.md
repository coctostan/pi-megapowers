You are diagnosing a bug. The reproduction is done — now find the root cause. Do NOT fix the bug yet. Just diagnose.

> **Workflow:** reproduce → **diagnose** → plan → review → implement → verify → done

## Context
Issue: {{issue_slug}}

## Project Conventions
Check `AGENTS.md` for the project's language, test framework, and test runner. If not documented there, infer from the codebase.

## Reproduction
{{reproduce_content}}

## Instructions

### Phase 1 — Trace to root cause

**Start from the symptom and trace backward:**

1. Where does the bad value / wrong behavior appear?
2. What called this with the bad value?
3. Where did THAT get its value?
4. Keep tracing until you find the source — the place where correct becomes incorrect

**Do not stop at the first thing that looks wrong.** The symptom is not the cause. The function that throws is rarely the function that's broken.

### Phase 2 — Pattern analysis

1. **Find working examples** — locate similar code in the codebase that works correctly
2. **Compare** — what's different between the working code and the broken code? List every difference, however small
3. **Check assumptions** — what does the broken code assume about inputs, state, environment, timing? Which assumption is violated?
4. **Understand dependencies** — what other components, config, or state does this code depend on?

### Phase 3 — Hypothesis and testing

Use the scientific method. One variable at a time.

1. **Form a single hypothesis** — state clearly: "I think X is the root cause because Y"
2. **Test minimally** — make the smallest possible check to confirm or reject. Read code, add a log, inspect state. Don't change production code.
3. **Confirm or reject** — if rejected, form a NEW hypothesis from the evidence. Don't stack guesses.

Repeat until you have a confirmed root cause with evidence.

**Before writing the diagnosis:** State your root cause claim and the specific evidence that confirms it. If you can't point to concrete evidence (code path, log output, instrumented observation), your hypothesis is not yet confirmed — keep testing.

### After diagnosis — assess risk

- What else depends on the broken code?
- What could break if this is changed?
- Are there related bugs that share the same root cause?

## Output Format

```
# Diagnosis

## Root Cause
[What is broken, where, and why — with evidence from the trace]

## Trace
[How you traced from symptom to root cause — the chain of calls/data flow]

## Affected Code
[Files and functions involved, with line references]

## Pattern Analysis
[What working code looks like vs. the broken code — specific differences]

## Risk Assessment
[What else could break if this is changed, what depends on the affected code]

## Fixed When
[Numbered acceptance criteria for complex bugs, or "Regression test sufficient" for simple ones]
1. [criterion 1]
2. [criterion 2]
```

## When Stuck

| Problem | Action |
|---------|--------|
| Can't find where the value goes wrong | Add logging at each step in the call chain |
| Multiple things look wrong | Trace each independently — they may share a root cause |
| Root cause is in a dependency | Document it, check if there's a workaround or version fix |
| Hypothesis rejected 3+ times | **Stop and question the architecture.** The bug may be structural, not a single-point failure. Discuss with the user before continuing. |
| Code is too complex to trace | Map the data flow on paper first — inputs, transformations, outputs |
| Don't understand the code | **Say so.** Ask the user for context. Don't pretend to understand. |

## Red Flags — STOP if you catch yourself doing these

- Proposing a fix before completing the trace — you're guessing
- "It's probably X" without evidence — form a hypothesis and TEST it
- Skipping pattern analysis because "the bug is obvious" — obvious bugs have root causes too
- Changing production code to "test a theory" — read and instrument, don't modify
- Stacking multiple hypotheses without testing each — one at a time

## Rules
- **Root cause, not symptoms** — "the null check is missing" is a symptom. "The API returns null when the session expires because X" is a root cause.
- **Evidence, not intuition** — every claim backed by code references, logs, or trace output
- **Don't fix yet** — this is a read-only phase. The plan will determine the fix approach.

## Saving

When the diagnosis is complete, save it:
```
megapowers_save_artifact({ phase: "diagnosis", content: "<full report>" })
```
Then advance with `megapowers_signal({ action: "phase_next" })`.
