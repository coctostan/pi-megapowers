---
id: 55
type: feature
status: open
created: 2026-02-24T19:35:00.000Z
---

# Examine and optimize builtin subagent definitions

## Problem

The three builtin agents (worker, scout, reviewer) are minimal placeholders — they all use the same model (`claude-sonnet-4-20250514`), the same thinking level (`full`), and have one-sentence system prompts. There's no differentiation beyond which tools are enabled. The agents don't leverage megapowers context (project conventions, current phase, plan details) and their prompts don't guide behavior for the specific workflows they'll be used in.

## Current State

| Agent | Model | Thinking | Tools | Prompt |
|---|---|---|---|---|
| worker | sonnet | full | read, write, edit, bash | 1 sentence — "execute precisely, tests first" |
| scout | sonnet | full | read, bash | 1 sentence — "research and explore" |
| reviewer | sonnet | full | read, bash | 1 sentence — "check correctness and style" |

## Areas to Examine

### Model selection per agent
- Should scouts use a cheaper/faster model since they're read-only?
- Should reviewers use a stronger reasoning model for catching subtle bugs?
- Should workers use the same model as the parent session rather than hardcoding?
- Cost/speed tradeoffs — a scout that takes 2 seconds on a fast model vs. 30 seconds on a reasoning model

### System prompt quality
- Worker prompts should include: TDD workflow expectations, file organization conventions, error handling patterns, how to signal completion
- Scout prompts should include: what to look for, how to structure findings, depth vs. breadth guidance
- Reviewer prompts should include: what constitutes a blocking issue, project-specific style rules, how to format feedback
- All prompts should be substantial enough to actually guide behavior, not just one sentence

### Agent variety
- **Planner agent** — help break down tasks, estimate complexity, identify dependencies
- **Test writer** — focused on writing comprehensive tests for existing code
- **Refactorer** — improve code quality without changing behavior
- **Documenter** — write/update docs, comments, READMEs
- Consider whether more agents is better or if fewer well-tuned agents cover more ground

### Phase-aware behavior
- Worker during implement should know about TDD red/green cycle
- Worker during verify should know about acceptance criteria checking
- Reviewer during code-review should know about the spec and plan
- Should agent prompts be dynamically augmented based on the current phase?

### Context injection
- Agents currently get: task description + plan section + learnings
- Should they also get: project architecture, relevant file summaries, recent errors?
- Balance between giving enough context and blowing the context window

## Out of Scope
- Agent chaining or pipelines (separate concern)
- Custom agent UI/management (tracked in other issues)
- Fundamental changes to agent dispatch mechanism (that's #032, already shipped)
