## Approach

Use a thin Megapowers orchestration layer over the already-loaded `pi-subagents` extension to improve plan review quality on larger plans. Megapowers remains the workflow authority and the only component allowed to submit `megapowers_plan_review`. The new behavior is advisory fan-out only: when a plan is large enough, Megapowers invokes three focused project agents in parallel — `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer` — and each writes one bounded artifact into `.megapowers/plans/<issue>/`.

The fan-out should be gated by a simple deterministic heuristic: task count. If the current plan has fewer than 5 tasks, review proceeds exactly as it does today. If it has 5 or more tasks, Megapowers triggers focused review fan-out via `pi-subagents` parallel execution. This keeps the feature cheap and invisible for small plans while improving review quality where a single reviewer is more likely to miss coverage gaps, hidden dependencies, or unrealistic task details.

The focused reviewers are explicitly advisory-only. Their artifacts inform the main review session, but they never approve or reject the plan themselves. The main reviewer reads the original plan inputs plus any available focused-review artifacts, notes any fan-out failures in the user-facing review, and then makes the final approve/revise decision.

## Key Decisions

- **Use `pi-subagents` as the execution layer** rather than building new subagent runtime code in Megapowers.
- **Keep Megapowers as sole review authority**; only the main session calls `megapowers_plan_review`.
- **Add three project-scoped agents** in `.pi/agents/`: `coverage-reviewer`, `dependency-reviewer`, `task-quality-reviewer`.
- **Use bounded artifact contracts**: `coverage-review.md`, `dependency-review.md`, `task-quality-review.md` in the active plan directory.
- **Gate fan-out by task count only** for v1; threshold is **5 tasks**.
- **Run focused reviewers in parallel** when fan-out is triggered.
- **Treat focused review as soft-fail advisory infrastructure**; missing artifacts never block the final main review.
- **Mention fan-out failures explicitly in user-facing review output** so degraded review depth is visible.
- **Avoid speculative generalization**; no generic review framework, retries, or mandatory policy in v1.

## Components

- **Three new agent prompt files**
  - `.pi/agents/coverage-reviewer.md`
  - `.pi/agents/dependency-reviewer.md`
  - `.pi/agents/task-quality-reviewer.md`
  Each prompt is narrow, bounded, and explicitly states that final approve/revise authority remains with the main session.

- **A pure fan-out gate helper**
  - Determines whether focused review should run based only on current task count.
  - Returns deterministic output that is trivial to unit test.

- **A thin plan-review fan-out orchestrator**
  - Builds the `pi-subagents` parallel request.
  - Supplies the correct plan inputs to each focused reviewer.
  - Maps each agent to its expected output artifact path.
  - Collects which artifacts were successfully produced.

- **Main review-context assembly logic**
  - Reads original plan inputs plus any focused-review artifacts.
  - Injects warnings when one or more focused reviewers fail.
  - Allows the main reviewer to proceed with partial or zero advisory results.

- **Prompt/documentation updates for plan review**
  - Explain when focused fan-out happens.
  - Document artifact names/locations consistently with the planning workflow.
  - Clarify that focused reviewers are advisory-only.

## Testing Strategy

- **Pure unit tests for gating**
  - `< 5` tasks → no fan-out
  - `>= 5` tasks → fan-out

- **Unit tests for orchestration contract**
  - Correct agent names selected
  - Correct output artifact paths assigned
  - Correct plan inputs passed to each focused reviewer

- **Failure-matrix tests**
  - `3/3` artifacts available → all included in main review context
  - `1–2/3` available → partial synthesis with explicit missing-artifact warnings
  - `0/3` available → main review proceeds solo and explicitly mentions focused review fan-out failure

- **Prompt contract tests**
  - Each focused agent prompt is advisory-only
  - Output format is bounded and concrete
  - No prompt claims final review authority

- **Plan-review integration tests**
  - When fan-out is not triggered, existing review behavior is unchanged
  - When fan-out is triggered, the main review context includes available artifacts and any failure notes

Real `pi-subagents` execution should be minimized in tests. Most coverage should come from stubbing dispatch/results and asserting on deterministic file contracts, warning behavior, and final review-context assembly.