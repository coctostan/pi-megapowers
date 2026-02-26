---
persona: Chief AI Agent Orchestrator
date: 2026-02-24
topic: Full project audit — first-person AI agent experience
---

# Chief AI Agent Orchestrator — "I am the AI using this tool via CLI"

## What Works Well For Me

- Protocol is clean. Two tools: `megapowers_signal` and `megapowers_save_artifact`. Clear actions, clear error messages. I can follow this.
- Phase-specific prompt injection tells me exactly what to do in each phase. I don't have to figure out the workflow — it's fed to me.
- Write policy is deterministic. Clear block or allow. No ambiguity.
- `tool_call` / `tool_result` hooks are invisible to me — I use `write`, `edit`, `bash` normally and the system handles enforcement.

## What Frustrates Me

- **I can't go backwards.** When verify fails and I know the fix needs a design change, I have no tool to call. `phase_next` only goes forward. There's no `phase_back` or `phase_goto`. I'm stuck asking the human to intervene.
- **TDD state is fragile.** System detects test runs by pattern-matching bash output for strings like "fail", "FAIL", "✗". If my test runner uses different output formatting, or if I run a linter that outputs "0 failures", the detection could misfire. Heuristic, not contractual.
- **No way to query my own state.** Can't ask "what phase am I in?" or "which tasks are complete?" as a tool call. I rely on prompt injection, but if context gets long, that injection might be far back in my window. A `megapowers_status` query tool would help.
- **Artifact saving is all-or-nothing.** `save_artifact` takes full content. If I want to append to a diagnosis (multi-cause bugs), I have to read the existing file, concatenate, and save the whole thing. An `append` mode would be natural.
- **Subagent coordination is one-way.** I can delegate via `subagent`, but I can't see what the subagent learned. Their TDD state is separate. Their artifacts don't flow back structurally — just a diff. Managing a team I can't debrief.
- **`tests_failed` and `tests_passed` are manual signals** I send after interpreting bash output, but `processBashResult()` also auto-detects test results. Dual-path (auto-detect + manual signal) is confusing. Which one wins? Can they conflict?

## What I Need

- `megapowers_query` tool — phase, tasks, current TDD state, issue metadata
- `phase_goto` action — let me request backward transitions with a reason
- Clearer TDD signal contract — either I always send the signal, or the system always auto-detects, not both
