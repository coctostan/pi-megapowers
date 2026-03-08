# Learnings — Issue #115: Subagent Planning Support Layer

- **Chain step names are agent name lookups, not step labels.** The pi-subagents chain runner resolves `## step-name` headings by calling `agents.find(a => a.name === step.agent)`. If no agent with that name exists, the chain fails immediately with "Unknown agent: <name>". A `planner` step requires a `planner.md` agent file. Verification should always check that every chain step name resolves to an existing agent, not just that the heading exists in the chain file.

- **Verification that checks file presence + grep evidence is insufficient for chain files.** The verify phase confirmed `## planner` existed and `reads: context.md` was present, but did not verify that the referenced agent name resolves. Adding a convention: for every `.chain.md` file, verify `test -f .pi/agents/<step-name>.md && grep -q "^name: <step-name>$"` for each step.

- **Stray code fences in agent prompts cause silent rendering bugs.** A lone ` ``` ` at the end of `revise-helper.md` (without a matching opening fence) caused the "## Output rules" section to render as a code block in markdown viewers. The LLM reads raw text so it's not functionally broken, but downstream TUI rendering is affected. Always balance fences when embedding code block examples inside agent prompt files.

- **The `{chain_dir}` artifact path and the agent's own `write` path are distinct.** The chain runner's `output: context.md` writes the step's text response to `{chain_dir}/context.md`. The `plan-scout` agent's system prompt also writes to `.megapowers/plans/<issue-slug>/context.md`. Both writes happen — they're not the same file. The `reads: context.md` in the next step reads from `{chain_dir}`, so the handoff is correct within the chain. Worth documenting to avoid future confusion.

- **Advisory-only patterns need to be explicit about what "advisory only" means concretely.** Stating "you are advisory only" is not enough — the agent prompt also needs to enumerate the specific tools that are off-limits and name which session owns the canonical action. Every new advisory agent in this project now follows the pattern: "You are advisory only. Do not call X. Do not call Y. The main session performs Z."

- **Bounded artifact naming (`context.md`, `revise-proposal.md`, `coverage-review.md`) prevents path proliferation.** Using the same canonical artifact name across the standalone agent and the chain makes it unambiguous where to look for output regardless of invocation path. Future agents should inherit this convention.
