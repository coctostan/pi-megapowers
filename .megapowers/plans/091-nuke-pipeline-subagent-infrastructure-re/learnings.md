# Learnings — Issue 091 (Nuke Pipeline/Subagent Infrastructure)

- **Deletion PRs are simpler to scope when the boundary is a tool surface.** Anchoring the cleanup to "these tools no longer appear in `registerTools()`" gave a clean, testable entry point. Everything that existed solely to serve those tools (workspace helpers, context accumulation, dispatcher, renderer, auditor) could be deleted without ambiguity once the registration was gone.

- **Filesystem-existence tests are a lightweight guard against reintroduction.** `tests/legacy-subagent-stack-removed.test.ts` simply calls `existsSync()` on each deleted module path. This is trivially cheap and makes it immediately obvious if someone accidentally re-creates a legacy file during a future refactor.

- **Satellite-mode branching in the entry point creates a hidden execution context that's hard to reason about.** The `if (satellite) { return; }` block in `index.ts` meant that a subagent session got a completely different extension behavior with no visual indication at the call site. Removing it eliminates that ambiguity — there is now exactly one code path through `megapowers()`.

- **Prompt wording that says "can be delegated to subagent" drifts fast after the delegation mechanism is removed.** The `buildRemainingTasksSummary` function had a one-liner that would have misdirected the LLM indefinitely if not caught in this cleanup. Prompt strings that reference runtime behavior should be treated with the same rigor as production code.

- **Keeping `pi-subagents` for focused review fan-out required explicit call-out in every doc update.** Without the "clearly distinguish preserved from deleted" rule, reviewers and future contributors would have reasonably inferred that `pi-subagents` itself was being removed. The pattern of using the exact import path (`from "pi-subagents/agents.js"`) as a test assertion (`legacy-subagent-stack-removed.test.ts`) makes the retention intention machine-checkable.

- **Test count in README drifts every PR.** The hardcoded "795 tests across 76 files" was stale immediately after verification reported 796. Docs that embed specific test counts age poorly; prose like "run `bun test` to see the current count" would be more durable.

- **`/mega on|off` tool toggling was silently still referencing removed tools.** The filter and restore arrays in `commands.ts` still listed `"pipeline"` and `"subagent"` even though those tools had been unregistered. The effect was benign (toggling non-existent tool names is a no-op), but the `commands-tools-filter.test.ts` static-source assertion caught it cleanly.
