# Brainstorm: Directory Restructure (#070)

## Approach

Reorganize the flat `extensions/megapowers/` directory (29 source files) into concern-based subdirectories, and slim `index.ts` from 870 lines to ~100 lines of pure wiring. This is a non-functional refactor — no behavior changes, just file moves, import updates, and code extraction.

Files with 3+ related modules get grouped into subdirs: `state/`, `tools/`, `policy/`, `subagent/`. Remaining files (ui, prompts, parsers, jj, satellite, task-coordinator) stay flat — they're either singletons or 2-file pairs not worth a directory. Test files stay flat in `tests/` with updated import paths.

The `index.ts` slimming extracts command handlers into `commands.ts`, event hooks into `hooks.ts`, and extends `satellite.ts` with the satellite setup block. The subagent spawn glue (~150 lines) stays in `index.ts` — it's irreducible pi-dependent code whose pure logic is already extracted into testable subagent-* modules.

## Key Decisions

- **Stay within `extensions/megapowers/`** — follows pi package convention (`package.json` declares `"extensions": ["./extensions"]`), no re-export bridge needed
- **3+ file threshold for subdirs (option B)** — groups state/, tools/, policy/, subagent/ while avoiding 2-file directory overhead for jj/, parsers/, prompts/
- **Extract commands.ts, hooks.ts from index.ts** — leaves index.ts as thin wiring (~100 lines: init capabilities, register hooks/tools/commands)
- **Extend satellite.ts** — move the satellite setup block from index.ts into a `setupSatellite(pi)` export
- **Don't extract subagent spawn glue** — the ~150 lines of pi.exec/spawn orchestration are irreducible pi-dependent code; pure logic already lives in tested subagent-* modules
- **Keep tests flat** — all 30 test files stay in `tests/`, only import paths change. Easy to scan, `bun test` discovers either way

## Components

### Target directory layout
```
extensions/megapowers/
├── index.ts              (~100 lines — thin wiring)
├── commands.ts           (NEW — 8 slash command handlers extracted from index.ts)
├── hooks.ts              (NEW — session_start, before_agent_start, tool_call, tool_result, agent_end)
├── state/
│   ├── state-machine.ts
│   ├── state-io.ts
│   ├── store.ts
│   └── derived.ts
├── tools/
│   ├── tool-signal.ts
│   ├── tool-artifact.ts
│   ├── tool-overrides.ts
│   └── tools.ts          (batch handler)
├── policy/
│   ├── write-policy.ts
│   ├── gates.ts
│   └── phase-advance.ts
├── subagent/
│   ├── subagent-agents.ts
│   ├── subagent-async.ts
│   ├── subagent-context.ts
│   ├── subagent-errors.ts
│   ├── subagent-runner.ts
│   ├── subagent-status.ts
│   ├── subagent-tools.ts
│   ├── subagent-validate.ts
│   └── subagent-workspace.ts
├── ui.ts                 (stays flat)
├── prompts.ts            (stays flat)
├── prompt-inject.ts      (stays flat)
├── plan-parser.ts        (stays flat)
├── spec-parser.ts        (stays flat)
├── jj.ts                 (stays flat)
├── jj-messages.ts        (stays flat)
├── satellite.ts          (extended with setupSatellite())
└── task-coordinator.ts   (stays flat)
```

### index.ts extraction targets
- **commands.ts**: handleMega, handleIssue, handleTriage, handlePhase, handleDone, handleLearn, handleTdd, handleTask, handleReview — each as a named export
- **hooks.ts**: onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd — each as a named export
- **satellite.ts**: setupSatellite(pi) — the entire satellite mode early-return block

## Testing Strategy

- **Zero behavior change** — this is a pure refactor. All 546 existing tests must pass with only import path updates.
- **No new tests needed** — no new modules, no new logic, just file moves and extractions.
- **Validation**: `bun test` green after each move batch (state/, tools/, policy/, subagent/, then index.ts extraction).
- **Import correctness**: TypeScript compiler catches any broken imports at build time.
