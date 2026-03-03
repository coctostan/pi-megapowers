# Learnings — 073-mp-command-hub

- **Registry-over-switch is the right pattern for hub commands.** The `MpRegistry = Record<string, MpHandler>` approach made adding new subcommands and rendering help a zero-branch operation. Stubs are just `comingSoonHandler("desc")` calls — no if/else tree to maintain.

- **Declaring subcommands in a const array (`MP_SUBCOMMANDS`) while also assigning them to a registry object creates two sources of truth that can drift.** A follow-up refactor should derive both the completion list and the registry keys from a single declarative definition table to guarantee consistency at compile time.

- **Making all `create_issue` tool parameters optional at the TypeBox level (then validating with Zod inside `execute`) is the right way to surface LLM validation errors.** If required fields are declared required in TypeBox, the LLM framework rejects the call before `execute` runs — the agent never sees a meaningful error message. The comment `// Keep fields optional here so zod validation errors are returned from execute()` should live in any tool that wants developer-friendly error feedback.

- **Inject-tier handlers that call `ctx.isIdle()` before `sendUserMessage` are more robust than unconditional sends.** The followUp fallback for non-idle contexts prevents messages from getting dropped silently during streaming — worth making standard boilerplate for all inject handlers.

- **Case normalization should happen at dispatch boundaries, not inside every handler.** A single `.toLowerCase()` on the subcommand at `dispatchMpCommand` entry covers all callers; handlers never need to think about casing. This was a minor bug caught during code review.

- **Optional metadata fields in frontmatter should be truly absent (not empty-string or 0) when not provided.** The pre-existing `milestone: ""` / `priority: 0` defaults in `store.ts` would have polluted every issue file. Making them `undefined` and only writing the frontmatter line when the value is meaningful produces clean files and avoids false-positive frontmatter checks in downstream parsers.
