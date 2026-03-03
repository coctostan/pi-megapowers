## Goal

Introduce a single `/mp` command that acts as a unified hub for megapowers subcommands, replacing the growing list of individually registered commands. The hub uses a typed handler registry with dispatch, implements `help` (default) and `new` subcommands, stubs all future subcommands for discoverability, and adds a `create_issue` LLM-callable tool backed by a Zod schema for programmatic issue creation with `milestone` and `priority` support.

## Acceptance Criteria

1. A single `/mp` command is registered via `pi.registerCommand("mp", ...)` that dispatches to subcommand handlers based on the first argument.
2. `/mp` with no arguments invokes the `help` handler (same as `/mp help`).
3. `/mp help` displays a formatted list of all registered subcommands with their descriptions.
4. `/mp` with an unknown subcommand displays the help listing (same as `/mp help`).
5. A handler registry maps subcommand names to handler objects, each with a `tier` (`"programmatic"` | `"inject"` | `"subagent"`), `description` string, and `execute` function.
6. `/mp new` is a tier `"inject"` handler that pushes a conversational issue-drafting prompt into the LLM context (does not create the issue directly).
7. The inject prompt for `/mp new` instructs the LLM to gather title, type, description, optional milestone, and optional priority, then call the `create_issue` tool.
8. A `create_issue` tool is registered with Zod-validated parameters: `title` (required string), `type` (required, `"feature"` | `"bugfix"`), `description` (required string), `milestone` (optional string), `priority` (optional number), and `sources` (optional number array).
9. The `create_issue` tool rejects input missing a `title` and returns an error message containing the validation failure.
10. The `create_issue` tool rejects input with an invalid `type` (not `"feature"` or `"bugfix"`) and returns an error message.
11. The `create_issue` tool calls `store.createIssue` and returns the created issue's slug and id on success.
12. `store.createIssue` accepts optional `milestone` and `priority` parameters (in addition to existing `title`, `type`, `description`, `sources`).
13. When `milestone` is provided to `createIssue`, the resulting issue file's frontmatter includes a `milestone:` field with that value.
14. When `priority` is provided to `createIssue`, the resulting issue file's frontmatter includes a `priority:` field with that value.
15. When `milestone` and `priority` are omitted, the issue file's frontmatter does not include `milestone:` or `priority:` lines (clean output, no empty fields).
16. Stub handlers for `council`, `audit`, `health`, `ship`, `retro`, `export`, `quick`, `back`, and `status` are registered in the handler registry with descriptions and return `"Coming soon."` when executed.
17. `/mp on` and `/mp off` continue to work as before (toggle mega enforcement), dispatched through the `/mp` command hub.
18. The `/mp` command provides tab completions for all registered subcommand names.
19. Existing standalone commands (`/mega`, `/issue`, `/phase`, `/done`, `/learn`, `/tdd`, `/task`, `/review`) remain functional and are not removed in this issue.

## Out of Scope

- Implementation of stub subcommands (`council`, `audit`, `health`, `ship`, `retro`, `export`, `quick`, `back`, `status`) beyond returning "Coming soon."
- Tier 3 (subagent) handler execution — framework only, no subcommand uses it yet.
- `/mp status` state-at-a-glance display (stub only).
- Issue list UI/UX with sorting, grouping, or visual indicators.
- Removing or deprecating existing standalone commands (`/mega`, `/issue`, etc.) — that's a separate migration issue.
- TUI wizard for issue creation.

## Open Questions

*(none)*
