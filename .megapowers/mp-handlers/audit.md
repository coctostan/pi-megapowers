# Audit Handler [STUB]

> **Status:** Designed, not fully implemented. Works for basic audits but lacks delegation and cross-referencing infrastructure.

## What It Will Do
Systematic project or scoped audit with delegation to subagents, cross-referencing prior audits, and incremental findings.

## What Works Now
You can do a basic audit manually — read relevant files, analyze, report. But it's the main agent doing all the work in a single context window, which gets expensive for full project audits.

## What's Missing
- **Delegation model:** Heavy audits should spawn subagents per scope area (tests, state, prompts, etc.) and synthesize
- **Prior audit cross-ref:** Should automatically diff against `.megapowers/audits/` and `.megapowers/council-feedback/` to avoid repeating known findings
- **Incremental mode:** `--diff` flag needs jj/git integration to scope to recent changes
- **Structured findings format:** Machine-readable output for tracking resolution over time

## Syntax (Planned)
```
/mp audit                  → full project audit (delegated to subagents)
/mp audit <scope>          → scoped: "prompts", "tdd", "state", "tests", "subagents"
/mp audit --diff           → recent changes only
```

## Output (Planned)
```
## Audit — <scope> — <YYYY-MM-DD>

### What Works
- <specific, with file references>

### What's Broken  
- <severity + file reference + impact>

### What's Missing
- <impact assessment>

### Delta from Last Audit
- <resolved since YYYY-MM-DD>
- <new findings>

### Recommendations
1. <prioritized, actionable>
```

Saved to `.megapowers/audits/YYYY-MM-DD-<scope>.md`.

## Dependencies
- Delegation infrastructure (subagent patterns for /mp)
- Prior audit indexing
- jj/git diff integration for `--diff` mode

## Interim
For now, use `/mp council --tech <scope>` for technical audit perspectives, or just ask the agent to audit a specific area directly.
