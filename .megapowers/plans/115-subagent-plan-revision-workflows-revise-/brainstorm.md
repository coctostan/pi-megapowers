## Approach
The chosen approach is intentionally thin and file-based. We will add one new advisory project agent, one real sequential project chain, and one reusable documentation artifact for the fan-out pattern. Specifically, the implementation should add `.pi/agents/revise-helper.md` for targeted plan revision support, `.pi/agents/draft-assist.chain.md` for the supported `plan-scout -> planner` flow, and a short project doc under `.megapowers/docs/` that captures the reusable review-fanout invocation pattern using `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`.

This design avoids inventing new megapowers runtime behavior. Existing pieces already cover most of the problem: `plan-scout` exists, the focused review agents already exist, focused review runtime fan-out already exists in code, and `pi-subagents` already supports sequential `.chain.md` files. After checking the actual `pi-subagents` parser/runtime, the key limitation is that saved markdown chain files are sequential and do not honestly express the richer parallel step structure the runtime can execute programmatically. Because of that, draft assist should be a real `.chain.md` file, while review fan-out should remain a documented reusable pattern until saved parallel chains become first-class.

The main session remains the workflow authority at all times. Subagents produce bounded advisory artifacts only. Canonical task edits still happen through the main session, and final `megapowers_plan_task`, `megapowers_plan_review`, and `plan_draft_done` ownership stays out of subagent prompts and chain task text.

## Key Decisions
- **Use a real draft-assist chain file** because `.chain.md` is already supported for sequential `plan-scout -> planner` flows.
- **Do not force review fan-out into a `.chain.md` file** because the current markdown chain parser does not model saved parallel steps cleanly.
- **Add `revise-helper` as advisory only** so plan revision remains targeted and does not bypass workflow authority.
- **Keep canonical state in the main session**; subagents may propose changes but must not submit `megapowers_plan_task`, `megapowers_plan_review`, or workflow transitions.
- **Prefer bounded artifact names** like `context.md`, `coverage-review.md`, `dependency-review.md`, `task-quality-review.md`, and `revise-proposal.md` for inspectability and testability.
- **Make `revise-helper` narrow by default**: required inputs are latest `revise-instructions-N.md` plus affected task files only.
- **Allow review artifacts only when relevant**: `revise-helper` should not read prior review artifacts unless the revise instructions explicitly point to a coverage/dependency concern or name those artifacts directly.
- **Keep review-fanout docs out of `.pi/agents/`** to avoid mixing executable agent definitions with passive documentation and to match `pi-subagents` discovery expectations.
- **Favor static contract testing over behavior speculation** because this feature is mostly prompt/chain/doc structure, not new runtime logic.

## Components
- **`.pi/agents/revise-helper.md`**
  - Narrow revise-support prompt.
  - Reads latest `revise-instructions-N.md`.
  - Focuses on affected `tasks/task-NNN.md` files only.
  - Produces targeted task-body replacements or edit snippets.
  - Includes a short global sanity check for coverage/dependency fallout.
  - Explicitly avoids rewriting unaffected tasks.
  - Explicitly states that the main session performs actual task edits and resubmission.

- **`.pi/agents/draft-assist.chain.md`**
  - Sequential chain for `plan-scout -> planner` (or equivalent planning synthesizer step).
  - Uses bounded artifact names, especially `context.md`.
  - Produces advisory planning output only.
  - Does not create canonical plan task state or call megapowers tools.

- **Review-fanout pattern doc under `.megapowers/docs/`**
  - Documents the reusable parallel pattern using `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`.
  - Names the bounded artifacts each agent writes.
  - States that outputs are advisory and the main review session synthesizes them.
  - States that final `megapowers_plan_review` remains in the main session.

## Testing Strategy
Treat this as a bounded artifact contract feature. The highest-value tests are deterministic file-content assertions rather than open-ended model-evaluation tests.

For `revise-helper.md`, tests should verify that the file exists, includes a narrow revise-support prompt, reads latest `revise-instructions-N.md`, targets only affected task files, tells the agent not to rewrite unaffected tasks, includes both local fix proposals and a short global sanity check, and explicitly says the main session performs actual edits and resubmission. Tests should also assert authority boundaries by checking that the prompt does not claim ownership of `megapowers_plan_task`, `megapowers_plan_review`, `plan_draft_done`, or workflow state.

For `draft-assist.chain.md`, tests should verify the file exists under `.pi/agents/`, has valid chain frontmatter, contains a `plan-scout` step followed by a planner step, uses bounded artifact names like `context.md`, and keeps final megapowers tool calls out of chain task text. Because the actual chain parser is sequential, tests should not assume undocumented saved parallel-chain syntax.

For the review-fanout doc in `.megapowers/docs/`, tests should verify that it names the three reviewer agents, the expected output artifacts (`coverage-review.md`, `dependency-review.md`, `task-quality-review.md`), and the rule that final review submission stays in the main session. This gives strong coverage while staying simple, maintainable, and honest about current runtime support.
