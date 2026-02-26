# Phase 6: Conventions & Standards — Process Template

> **What we learned by doing this on megapowers, 2026-02-25**

---

## Purpose

Answer: **"How do we write code on this project?"**

Codify the conventions that the dev workflow needs to reference — test protocol, naming, code patterns, commit style. This is what subagents and dev phases use to produce consistent output.

## Critical Rule: Concise and Functional

This is NOT a comprehensive style guide. It's a cheat sheet. Only include what the process actually uses:

- **Subagents need:** test protocol (how to run tests, where to put them), naming conventions (file/type/function naming), code patterns (error handling, imports), commit conventions
- **Plan/review needs:** issue format, naming conventions
- **Done phase needs:** commit conventions, artifact naming
- **Brainstorm/spec needs:** nothing from conventions (these are collaborative, not code-producing)

If a convention doesn't serve one of these consumers, it doesn't belong here.

## Brownfield Process

For brownfield, the LLM reads the codebase and documents existing conventions. The human refines.

1. **LLM reads:** imports, test files, file structure, naming patterns, package.json, config files (tsconfig, linter, formatter)
2. **LLM drafts:** conventions doc based on what it observes
3. **Human refines:** corrects, adds missing conventions, removes fluff

This is fast — 15-20 minutes. The codebase already has conventions; you're documenting them, not inventing them.

## Greenfield Process

For greenfield, this is a conversation:

1. **LLM asks:** "What language/runtime? Test framework? Naming conventions? Preferred patterns?"
2. **Human answers** or says "you pick, use standard conventions for X"
3. **LLM drafts** conventions doc
4. **Human refines**

## Sections

1. **Language & Runtime** — what, what version, module system
2. **Test Protocol** — runner, location, naming, framework, patterns, coverage expectations
3. **File & Module Conventions** — structure, size guidelines, purity preference
4. **Naming Conventions** — files, types, functions, constants, issues, artifacts
5. **Issue Format** — frontmatter schema, body structure
6. **Commit Conventions** — message style, granularity
7. **Error Handling** — result types vs exceptions, surfacing errors
8. **Prompt Templates** — location, format, naming (if the project uses LLM prompts)

**Required outputs:**
- `TESTING.md` — injectable test conventions for implement/verify phases. Under 1KB.
- `IMPLEMENTATION.md` — injectable code conventions for implement/code-review phases. Under 1KB.

These are the bare minimum. Additional injectable docs can be added when a phase needs project-specific conventions that aren't covered (e.g., `REVIEW.md`). Every injectable doc must be concise — they get loaded into subagent prompts and are context-eaters.

**Optional outputs:**
- README.md — if missing or stale
- AGENTS.md — if missing or stale

All outputs should be concise. Context for AI agents, not documentation for documentation's sake.

## What We Learned

- **Brownfield conventions write themselves.** Reading 5-10 source files and the test directory gives you 90% of the conventions. The LLM drafts, the human just confirms.
- **Conventions are context-eaters.** Every line in the conventions doc is a line that gets injected into subagent prompts or read by dev phase prompts. Keep it tight.
- **No formatter/linter? That's a convention too.** "Follow what's there" is a valid convention. Don't invent tooling requirements the project doesn't have.

## Gate

Conventions doc exists and covers: test protocol, naming, code patterns, commit conventions. A subagent could read it and produce code that looks like the rest of the codebase.
