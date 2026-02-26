# Ship Report Handler [STUB]

> **Status:** Designed, not fully implemented. Can generate a basic report from existing artifacts, but lacks transition log, cycle time, and done-phase integration.

## What It Will Do
Generate a shareable proof-of-quality summary. The artifact people screenshot and share. "Built with Megapowers 🏋️."

## What Works Now
Can read existing artifacts (spec, plan, verify, code-review) and assemble a manual summary. But it's missing the data that makes it powerful.

## What's Missing
- **Transition log:** No timestamped record of phase transitions → can't calculate cycle time or show the decision chain with timing
- **Done phase (#065):** Ship report is the natural output of a working done phase. Done phase is currently broken — learnings aren't captured, wrap-up actions don't fire
- **Test metrics:** No structured capture of test counts per issue. `verify.md` may have them, but inconsistently
- **Files changed tracking:** Needs jj/git diff scoped to the issue's changes
- **Delegation:** Reading all artifacts + synthesizing is a good subagent task

## Output (Planned)
```
## 🚀 Ship Report — #NNN: <Title>

**Workflow:** feature | **Phases:** 8/8 | **Time:** ~2h 15m

### Decision Chain
| Phase | Duration | Key Decision |
|-------|----------|-------------|
| Brainstorm | 12m | Explored 3 approaches, chose X |
| Spec | 8m | 5 acceptance criteria |
| Plan | 15m | 4 tasks, TDD |
| Review | 3m | Approved first pass |
| Implement | 1h 20m | 12 files, 340 lines |
| Verify | 10m | All 5 AC met |
| Code Review | 7m | No blockers |

### Test Coverage
- New tests: 8 | All tests: 574 pass, 0 fail
- TDD enforced: yes, all tasks

### Files Changed
<list with brief descriptions>

### Learnings
<from done phase capture>

---
*Built with Megapowers 🏋️ — spec'd, planned, reviewed, test-driven, verified.*
```

Saved to `.megapowers/ship-reports/NNN-<slug>.md`.

## Dependencies
- Transition log with timestamps (feeds cycle time + decision chain)
- Done phase (#065) working (feeds learnings)
- jj/git diff per issue (feeds files changed)
- Delegation infrastructure

## Interim
Can generate a partial report from whatever artifacts exist. Won't have timing data or file diffs. Ask: "generate a ship report for the current issue from existing artifacts."
