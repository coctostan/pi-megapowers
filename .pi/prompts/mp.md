---
description: "Megapowers universal command — /mp council | new | quick | status | audit | health | back | ship | learn | retro | export | help"
---

# `/mp` — Megapowers Dispatcher

Subcommand: first word of `$ARGUMENTS`. Remaining words are args.

## Inline commands (no handler file needed)

### `help` (or empty)
Print:
```
/mp new <desc>       Create issue, start working
/mp quick <desc>     Lightweight fix, skip ceremony
/mp status           State at a glance
/mp back [phase]     Go back to a previous phase
/mp council [flags] <topic>  Persona council (--full|--tech|--biz|--chaos)
/mp audit [scope]    Project or feature audit
/mp health           Automated health check
/mp ship [issue]     Generate ship report
/mp learn [insight]  Capture a learning
/mp retro [issue]    Retrospective
/mp export [issue]   Export decision chain
```

### `status`
Read `.megapowers/state.json`. Read `.megapowers/issues/` to count open (status: open in frontmatter) vs total. If `activeIssue` is set, read that issue file. Report as a compact table: enforcement on/off, active issue or "none", workflow, phase, task progress if in implement, open/total issue count. Omit empty sections.

### `learn`
If args provided, that's the insight. If not, ask "What did you learn?" Read `.megapowers/state.json` for issue context. Append to `.megapowers/learnings.md`: `### <YYYY-MM-DD HH:MM> — Issue #NNN: <title> (phase)\n<insight>`. Confirm with count.

## Routed commands (load handler file, follow its instructions)

| Subcommand | Handler |
|------------|---------|
| `council` | `.megapowers/mp-handlers/council.md` |
| `new` | `.megapowers/mp-handlers/new.md` |
| `quick` | `.megapowers/mp-handlers/quick.md` |
| `audit` | `.megapowers/mp-handlers/audit.md` |
| `health` | `.megapowers/mp-handlers/health.md` |
| `back` | `.megapowers/mp-handlers/back.md` |
| `ship` | `.megapowers/mp-handlers/ship.md` |
| `retro` | `.megapowers/mp-handlers/retro.md` |
| `export` | `.megapowers/mp-handlers/export.md` |

Unknown subcommand → "Unknown: <X>. Try /mp help."
