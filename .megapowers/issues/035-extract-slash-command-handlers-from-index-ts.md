---
id: 35
type: feature
status: open
created: 2026-02-23T22:45:00.000Z
---

# Extract slash command handlers from index.ts

`index.ts` is 588 lines and the highest-coupling file in the project (14 internal imports). Most of that bulk is inline slash command handlers (`/mega`, `/issue`, `/learn`, `/plan`, etc.) that could be extracted into a dedicated module.

This would bring `index.ts` in line with the pattern established by 030 — where tool handlers were extracted to `tool-signal.ts`, `tool-artifact.ts`, and `tool-overrides.ts` — but for slash commands.

## Motivation

- `index.ts` is the only file over 300 lines
- Slash command logic is self-contained per command — no shared mutable state between handlers
- Extracting makes each command independently testable without mocking the full extension lifecycle
- Reduces the fan-out of `index.ts` since many imports are only used by specific commands

## Scope

- Extract slash command handlers to `slash-commands.ts` (or one file per command group)
- `index.ts` becomes pure wiring: register hooks, register tools, register commands, delegate
- No behavior changes — pure refactor
