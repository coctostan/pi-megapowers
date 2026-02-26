# `/mp` Command Architecture

**Date:** 2026-02-25
**Status:** Design — not yet implemented

## Core Insight

Pi's `registerCommand` is strictly superior to prompt templates for user-facing commands:
- Zero context cost for programmatic work
- Selective AI involvement (none, lightweight inject, or subagent)
- Deterministic dispatch (TypeScript, not prompt interpretation)
- Same UX surface: user types `/mp <thing>`, result appears

## Three-Tier Execution Model

### Tier 1: Programmatic (0 tokens, instant)
TypeScript reads files, formats output, displays in TUI. No AI involved.

| Command | What It Does |
|---------|-------------|
| `status` | Read state.json + count issues → TUI table |
| `help` | Print command list → TUI |
| `learn <text>` | Append to learnings.md with timestamp + issue context |

### Tier 2: Lightweight Inject (~50-100 tokens)
Push a minimal prompt into the current conversation. AI handles it interactively.

| Command | Injected Prompt |
|---------|----------------|
| `new <desc>` | "Create issue from: <desc>. Classify feature/bugfix, generate slug, write to .megapowers/issues/. One question max." |
| `quick <desc>` | "Quick-fix issue: <desc>. Create issue, guide implement→verify→done." |
| `back [phase]` | "Backward transition requested. Current phase: <X>. Target: <Y>. Ask for reason, log it, attempt transition." |

### Tier 3: Subagent (0 tokens on parent, isolated context)
Spawn subagent with full specialized prompt. Results flow back.

| Command | Subagent Prompt Source | Why Subagent |
|---------|----------------------|-------------|
| `council` | `.megapowers/mp-handlers/council.md` | 18 personas, massive output |
| `audit` | `.megapowers/mp-handlers/audit.md` | Reads entire codebase |
| `health` | `.megapowers/mp-handlers/health.md` | Runs tests, validates state |
| `ship` | `.megapowers/mp-handlers/ship.md` | Reads all artifacts, synthesizes |
| `retro` | `.megapowers/mp-handlers/retro.md` | Heavy analysis |
| `export` | `.megapowers/mp-handlers/export.md` | File bundling |

## Relationship to Existing Commands

Current registered commands and their fate:

| Existing | What It Does | Relationship to /mp |
|----------|-------------|-------------------|
| `/mega` | on/off/dashboard | **Keep.** TUI toggle. /mp doesn't replace this. |
| `/mega on/off` | Toggle enforcement | **Keep.** Programmatic necessity. |
| `/phase` | Phase info/advance | **Overlap.** `/mp status` covers info. `/phase next` stays (or becomes `/mp next`?). |
| `/task` | Task management | **Overlap.** `/mp status` shows tasks. `/task done` stays (or via megapowers_signal). |
| `/review` | Review management | **Keep.** Thin wrapper around megapowers_signal. |
| `/done` | Done phase menu | **Overlap.** `/mp ship` + `/mp learn` cover the valuable parts. |
| `/learn` | Capture learning | **Replaced by** `/mp learn`. |
| `/tdd` | TDD guard control | **Keep.** Specialized, low-level. |
| `/issue` | Issue CRUD | **Overlap.** `/mp new` creates. `/mp status` shows. `/issue` for activation. |
| `/triage` | Triage open issues | **Overlap.** Could become `/mp triage` later. |

**Decision needed:** Do we consolidate into `/mp` or keep both? Recommendation: keep existing commands for now (backward compat), build `/mp` as the unified layer on top. Deprecate duplicates later once `/mp` is proven.

## Implementation Approach

In `extensions/megapowers/index.ts`:

```typescript
pi.registerCommand("mp", {
  description: "Megapowers command center",
  execute: async (ctx) => {
    const args = ctx.args?.trim() ?? "";
    const [sub, ...rest] = args.split(/\s+/);
    const subArgs = rest.join(" ");

    switch (sub) {
      // Tier 1: Programmatic
      case "help": case "": case undefined:
        return showHelp(ctx);
      case "status":
        return showStatus(ctx);
      case "learn":
        return recordLearning(ctx, subArgs);

      // Tier 2: Lightweight inject
      case "new":
        return injectNewIssuePrompt(ctx, subArgs);
      case "quick":
        return injectQuickFixPrompt(ctx, subArgs);
      case "back":
        return injectBackPrompt(ctx, subArgs);

      // Tier 3: Subagent
      case "council":
      case "audit":
      case "health":
      case "ship":
      case "retro":
      case "export":
        return spawnMpSubagent(ctx, sub, subArgs);

      default:
        ctx.ui.notify(`Unknown: ${sub}. Try /mp help.`, "warn");
    }
  }
});
```

## Infrastructure Dependencies

Commands that are blocked until infra exists:

| Infra | Needed By | Status |
|-------|-----------|--------|
| Transition log (append-only phase transitions with timestamps) | ship, retro, export, health | Not built |
| Backward transitions (#069) | back | Not wired |
| Done phase (#065) | ship, retro | Broken |
| Artifact versioning (#041) | export | Not built |
| Subagent prompt injection pattern | council, audit, health, ship, retro, export | Needs design |
| Telemetry foundation | health, retro | Not built |

## Open Questions

1. **Subagent UX:** When `/mp council` spawns a subagent, what does the user see? A loading indicator? Streamed output? A notification when done? Need to understand pi's subagent UX model.
2. **Message injection API:** How does `registerCommand` inject a message into the current conversation? Is it `ctx.sendMessage()`? `ctx.addUserMessage()`? Need to check pi API.
3. **Result display for subagents:** Subagent produces markdown. Where does it go? TUI panel? Injected as assistant message? Written to file and user notified?
4. **Command consolidation timing:** When do we deprecate `/learn` in favor of `/mp learn`? After v1 is stable?
