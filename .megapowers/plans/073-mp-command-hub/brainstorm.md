# Brainstorm: /mp Command Hub & Issue Creation Tool

## Approach

Register a single `/mp` command via `pi.registerCommand("mp", ...)` that parses the first arg as a subcommand and dispatches to typed handlers. Each handler has a tier (`programmatic`, `inject`, or `subagent`) and a simple execute function. The dispatch framework + registry is the main deliverable — individual subcommands are deliberately thin.

Two subcommands are fully implemented: `help` (default when no args) and `new`. All others from the existing handler stubs (`council`, `audit`, `health`, `ship`, `retro`, `export`, `quick`, `back`, `status`) are registered in the registry with descriptions but return "Coming soon." This gives discoverability now and easy expansion later.

The `create_issue` tool is a new LLM-callable tool with a zod schema for issue creation. `/mp new` injects a prompt that kicks the LLM into conversational issue drafting, ending with a `create_issue` tool call. The store's `createIssue` method gets extended to accept `milestone` and `priority`.

## Key Decisions

- **Single `/mp` command with arg dispatch** — not multiple registered commands. Keeps the command namespace clean and makes the help listing self-contained.
- **Three handler tiers** — programmatic (pure TS, zero tokens), inject (push prompt into conversation), subagent (spawn isolated agent). Only tiers 1 and 2 implemented now.
- **Zod schema for `create_issue` tool** — formalizes the issue frontmatter contract. LLM gets typed parameters, tool validates before write.
- **`/mp new` = inject prompt, not TUI wizard** — the LLM handles conversational drafting, the tool handles validation + persistence. Clean separation.
- **Stubbed handlers exist in registry** — discoverable via `/mp help`, ready to implement as separate issues.
- **Store extension, not rewrite** — `createIssue` gets optional `milestone`/`priority` params, `formatIssueFile` writes them when present.
- **`/mp status` and issue list UI deferred** — separate follow-up issue for sorting, grouping, visual polish.

## Components

1. **`mp-command.ts`** — Handler registry type, dispatch function, `/mp` command registration
2. **`mp-handlers.ts`** — `help` and `new` handlers + stub handlers for all future commands
3. **`issue-schema.ts`** — Zod schema for `CreateIssueInput`, validation
4. **`tool-create-issue.ts`** — `create_issue` tool registration + handler
5. **Store extension** — `createIssue` accepts `milestone?` + `priority?`, `formatIssueFile` writes them
6. **Prompt template** — `/mp new` inject prompt for conversational issue creation

## Testing Strategy

- **Dispatch tests** — unknown subcommand shows help, correct routing, arg passing
- **Handler tests** — `help` lists all registered commands with descriptions, stubs return "Coming soon"
- **Zod schema tests** — valid/invalid payloads, defaults for optional fields, edge cases (missing title, bad type)
- **`create_issue` tool tests** — creates file with correct frontmatter, auto-increments ID, validates required fields, rejects invalid input
- **Store extension tests** — `createIssue` with/without milestone/priority, `formatIssueFile` output includes new fields

## Deferred

- `/mp status` — state-at-a-glance display
- Issue list UI/UX — sorting by milestone→priority, grouping, visual indicators
- Tier 3 (subagent) handler implementations
