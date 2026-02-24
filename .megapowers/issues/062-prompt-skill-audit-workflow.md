---
id: 62
type: feature
status: open
created: 2026-02-24T20:10:00.000Z
---

# Prompt/skill markdown audit, change, and creation workflow

## Problem

Megapowers currently only has one workflow shape: brainstorm → spec → plan → review → implement (TDD) → verify → code-review → done. This works well for code-centric tasks but is a poor fit for **prompt engineering and skill authoring** work, which is:

- **Not TDD-able** — prompts are natural language. There's no failing test to write first. The TDD guard actively blocks this work.
- **Iterative by nature** — prompt work is draft → test with LLM → evaluate output → revise → repeat. The feedback loop is "did the LLM do the right thing?" not "did tests pass?"
- **Collaborative** — prompt wording directly shapes LLM behavior in every future session. Changes need human review before committing, not automated verification.
- **Cross-cutting** — a prompt audit (#040) touches 15+ files but each change is small. The current per-task TDD cycle creates massive overhead for one-line wording tweaks.

## Desired Behavior

A separate workflow type (alongside `feature` and `bugfix`) tailored for prompt/skill/markdown content work:

### Workflow shape
Something like: **audit → draft → review → apply → done** (or similar — needs design). Key differences from feature workflow:
- No TDD enforcement at any phase
- Write policy allows `.md` files freely throughout
- "Implement" equivalent is collaborative: agent proposes changes, user approves each one
- Verification is human evaluation ("does the LLM behave better?"), not test suites

### Use cases
1. **Prompt audit** — review all injected prompts for accuracy, consistency, completeness. Propose edits per file.
2. **Skill creation** — author new pi skills (SKILL.md + supporting files). Iterative drafting with user feedback.
3. **Agent definition** — create/tune agent `.md` files (model, tools, system prompt). Test by running subagents.
4. **Template authoring** — new phase prompt templates, README templates, etc.
5. **Documentation** — AGENTS.md, README, changelog — structured doc work.

### What it should NOT be
- Not a general "no-TDD" escape hatch — code tasks should still go through the feature/bugfix workflow
- Not fully autonomous — prompt work needs human-in-the-loop approval at each change

## Integration Points

- `state-machine.ts` — new workflow type with its own phase graph
- `write-policy.ts` — different policy for this workflow (`.md` always writable, no TDD)
- `prompt-inject.ts` — phase prompts for the new workflow
- `ui.ts` — workflow selection when starting an issue
- Issue frontmatter — `type: prompt` or similar to route to this workflow

## Related

- #040 — Prompt audit is the immediate use case that needs this workflow
- #055 — Agent optimization work would use this workflow
- #044 — Write policy flexibility (partially addressed by this — `.md` writes in all phases)
- #047 — TDD blocking type-only tasks (this workflow avoids TDD entirely)
