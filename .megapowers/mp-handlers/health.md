# Health Handler [STUB]

> **Status:** Designed, not fully implemented. Individual checks work manually but no automated orchestration.

## What It Will Do
Automated project health check — run tests, validate state, check artifacts, flag known issues. Single command, structured report, color-coded status.

## What Works Now
Each check can be done manually:
- `bun test` for test status
- Read `state.json` for state consistency
- Check artifact files exist
- Scan issues for hygiene

But there's no orchestration, no structured output, no history tracking.

## What's Missing
- **Delegation:** Should spawn subagents for parallel checks (tests in one, state validation in another)
- **State validation logic:** No programmatic validation that phase is consistent with workflow, that completed tasks match plan, that artifact gates are satisfied
- **Health history:** Should track health over time — is the project getting healthier or degrading?
- **Known issue tracking:** Should automatically check if filed issues (#065, #067, #069) are still present in code

## Checks (Planned)

| Check | What | How |
|-------|------|-----|
| Tests | Pass/fail count | `bun test` |
| State | Phase valid for workflow, activeIssue exists, task indices in range | Read + validate `state.json` |
| Artifacts | Prior-phase artifacts present | Check files per phase requirements |
| Issues | Frontmatter complete, no orphaned refs | Scan `.megapowers/issues/` |
| Known Bugs | Filed issues still unresolved | Check code patterns |
| Dead Code | Known dead code still present | grep for specific patterns |

## Output (Planned)
```
## Health Check — <YYYY-MM-DD>

| Check | Status | Details |
|-------|--------|---------|
| Tests | ✅ / ⚠️ / ❌ | N pass, M fail |
| State | ✅ / ❌ | <details> |
| Artifacts | ✅ / ⚠️ | N/M present |
| Issues | ✅ / ⚠️ | <details> |
| Known Bugs | ✅ / ❌ | N unresolved |

**Overall: 🟢 GOOD / 🟡 FAIR / 🔴 POOR**

**Trend:** ↑ improving / → stable / ↓ degrading (vs last check)
```

## Dependencies
- Delegation infrastructure
- State validation functions (could live in `extensions/megapowers/` as reusable logic)
- Health history storage (`.megapowers/health/`)

## Interim
Run `bun test` and read `state.json` manually. Or ask the agent: "check if the tests pass and the state is consistent."
