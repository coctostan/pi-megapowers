# Learnings — Issue 113 (plan-scout + experiment boundaries)

- **Listing forbidden tools by exact name is stronger than vague prohibitions.** The authority-boundaries section in `plan-scout.md` names every disallowed tool (`megapowers_plan_task`, `megapowers_plan_review`, `megapowers_signal`, `state.json`) rather than saying "do not use megapowers tools." A vague rule invites a model to interpret it narrowly; a named list closes that loophole. Apply this pattern whenever prompts need hard fences.

- **Fail-closed beats fallback in advisory agents.** The scout stops and reports when neither `spec.md` nor `diagnosis.md` exists, rather than producing a repo-only summary. A silently degraded artifact would mislead the planner more than no artifact at all. For any advisory agent that depends on a required input artifact, make the missing-input path explicit and terminal.

- **The `edit` tool is for patch workflows; `write` is for create-fresh workflows.** The scout omits `edit` from its tool list because it creates `context.md` fresh on each run. Reserving `write`-only for create-fresh prevents accidental partial patches of stale content. Consider documenting this distinction explicitly when defining agent tool lists.

- **Shell quoting kills `-lc` verification scripts when the pattern contains backticks.** The plan's `bash -lc '...'` verification commands failed because backtick characters inside the single-quoted string were interpreted as command substitution by the login shell. Switching to bare `grep -Fq` (fixed-string, quiet) with plain `&&` chaining avoids the quoting issue entirely and is more portable.

- **Existing test regexes constrain future prompt rewrites.** `tests/prompts.test.ts:312` matches `do not use.*pipeline|do not use.*subagent|pipeline.*broken|subagent.*broken`. The new implement-task wording had to keep `Do NOT use ... pipeline` to keep matching. Before rewriting any prompt, grep tests/ for assertions against that prompt's content to avoid silent regressions.

- **Inserting a subsection directly after a phase heading with no body looks like a sibling, not a child.** `## Phase 2 — Subagent-Assisted...` has no body paragraph — its first content is `## V1 project-scoped scout rollout`. Both are H2, matching the document's flat convention, but it reads as two sibling sections when one is conceptually inside the other. For design docs with multi-phase structure, either give phase headings a one-line summary paragraph or use H3 for subsections.

- **A concrete delivery vehicle (external extension) unblocks an experimental feature without requiring runtime changes.** Specifying `pi-subagents` as the v1 mechanism let this issue ship the agent definition and experiment documentation without touching any TypeScript. The scope stayed tight. When a new capability can be prototyped at the prompt/config layer before committing to runtime wiring, prefer that path for the first iteration.
