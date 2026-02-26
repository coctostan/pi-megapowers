# Retro Handler [STUB]

> **Status:** Designed, not fully implemented. Can do a qualitative retro from artifacts, but lacks the quantitative data that makes retros actionable.

## What It Will Do
Structured retrospective combining qualitative observations with quantitative workflow metrics. Identifies friction points, captures learnings, suggests process improvements.

## What Works Now
Can read artifacts and learnings for an issue and do a qualitative "what went well / what was painful" analysis. But it's opinion, not data.

## What's Missing
- **Transition log:** No record of phase transitions → can't identify where time was spent, where backward transitions happened, or where the user got stuck
- **`/mega off` tracking:** No log of when enforcement was disabled → can't identify where the workflow was too rigid
- **TDD skip tracking:** No aggregate record of when TDD was skipped → can't identify patterns
- **Backward transition reasons:** #069 isn't wired, so there are no backward transitions to analyze yet
- **Cross-issue patterns:** Single-issue retros are useful, but the real value is patterns across multiple issues ("we always get stuck in spec phase")

## Output (Planned)
```
## Retrospective — #NNN: <Title>

### What Went Well
- <specific, referencing phases/artifacts>

### What Was Painful
- <backed by data: time-in-phase, backward transitions, overrides>

### Learnings
- <from learnings.md + inferred from metrics>

### Process Metrics
| Metric | Value |
|--------|-------|
| Total time | 2h 15m |
| Longest phase | implement (1h 20m) |
| Backward transitions | 1 (verify → implement) |
| TDD skips | 0 |
| Enforcement overrides | 0 |
| First-pass verify | No (1 loop) |

### Suggestions for Next Time
- <concrete, actionable, informed by data>
```

Saved to `.megapowers/retros/NNN-<slug>.md`.

## Dependencies
- Transition log with timestamps
- `/mega off` event logging
- TDD skip/override logging  
- Backward transitions (#069) working
- Cross-issue aggregation for pattern detection

## Interim
Can do a qualitative retro from existing artifacts and learnings. Ask: "do a retro on the current issue based on what artifacts exist." Won't have timing or metrics.
