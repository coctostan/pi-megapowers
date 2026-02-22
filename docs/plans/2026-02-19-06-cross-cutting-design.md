# 06: Cross-Cutting Concerns Design

## Overview

Three cross-cutting features that provide context continuity across issues and sessions: project learnings, living documentation, and roadmap awareness. These features inject accumulated knowledge into the right phases and produce durable artifacts at issue completion.

## Project Learnings

### Storage

Learnings are stored in `.megapowers/learnings.md` as an append-only markdown file. Each entry is timestamped and attributed to the issue that produced it.

```markdown
## 2026-02-19 — auth-flow

- The token service requires mocking via dependency injection, not module stubbing
- Rate limiter tests need a fake clock — real timers cause flaky failures

## 2026-02-20 — retry-logic

- Exponential backoff needs a jitter component to avoid thundering herd
```

### Injection

Learnings are injected into **brainstorm and plan phase prompts only**. They inform design decisions and planning but don't clutter implementation or verification contexts.

All learnings are injected — no relevance filtering. The file is expected to stay manageable in size, and the LLM can determine what's relevant to the current task.

### Capture

**Primary:** At the Done phase, the done prompt asks the LLM to reflect on the completed issue and suggest learnings. The LLM drafts entries, the user reviews, and approved learnings are appended to the file.

**Ad-hoc:** The `/learn` command remains available at any time for manual capture during any phase.

### Prompt Integration

The brainstorm and plan phase prompt templates include a `{{learnings}}` interpolation variable. The prompt builder reads `.megapowers/learnings.md` and injects its contents. If the file doesn't exist or is empty, the variable resolves to an empty string.

## Living Documentation

### Feature Doc

At the Done phase, the LLM drafts a feature document for the completed issue using a structured prompt (`generate-docs.md`). The prompt is populated with real artifacts:

- **Spec** — the validated specification from the spec phase
- **Plan** — task list with completion status
- **Acceptance criteria** — pass/fail results from verification
- **Files changed** — discovered via `jj diff` on the issue's changes
- **Learnings** — any captured during the issue

The prompt guides the LLM to produce a consistent structure:

```markdown
# Feature: {issue title}

## Summary
Brief description of what was built and why.

## Design Decisions
Key architectural choices and trade-offs.

## API / Interface
Public API, commands, configuration added or changed.

## Testing
Testing approach, notable test cases, coverage notes.

## Files Changed
List of files added/modified with brief descriptions.
```

The generated doc is saved to `.megapowers/docs/{issue-slug}.md`.

### Changelog Entry

Also at the Done phase, the LLM drafts a changelog entry — a concise summary suitable for a project CHANGELOG. The prompt provides the same artifacts but guides toward a brief, user-facing description.

The entry is appended to `.megapowers/CHANGELOG.md` (or a project-level `CHANGELOG.md` if one exists).

### Done Phase Menu

The Done phase menu surfaces both doc generation options:

- **Generate feature doc** — triggers the `generate-docs.md` prompt with artifacts
- **Write changelog entry** — triggers the changelog prompt
- **Capture learnings** — triggers the learnings reflection prompt
- **Close issue** — finalizes the issue

All three documentation actions happen before issue closure.

## Roadmap Awareness

### Discovery

Megapowers looks for `ROADMAP.md` in the project root directory. If the file exists, its contents are read and made available for prompt injection. If it doesn't exist, the feature is silently skipped.

### Injection

Roadmap contents are injected into **brainstorm and plan phase prompts only**, alongside learnings. This gives the LLM awareness of the project's direction when making design and planning decisions.

The brainstorm and plan prompts include a `{{roadmap}}` interpolation variable. The prompt builder reads `ROADMAP.md` from the project root and injects its contents. If the file doesn't exist, the variable resolves to an empty string.

### Usage

The LLM uses roadmap context to:
- Align feature design with project goals during brainstorm
- Scope implementation appropriately during planning
- Avoid building something that conflicts with upcoming work

## Components

### Modifications

- **`prompts.ts`** — Add `{{learnings}}` and `{{roadmap}}` interpolation to brainstorm and plan phase prompt builders. Remove learnings injection from all other phases.
- **`prompts/brainstorm.md`** — Add learnings and roadmap context sections
- **`prompts/write-plan.md`** — Add learnings and roadmap context sections
- **`prompts/generate-docs.md`** — Restructure as a detailed prompt with artifact placeholders (spec, plan, criteria, files changed, learnings)
- **`store.ts`** — Add `appendLearnings(issueSlug, entries)` method. Add `readRoadmap()` method.
- **`ui.ts`** — Update Done phase menu: add "Generate feature doc", "Capture learnings" actions. Wire changelog and feature doc generation with artifact context.
- **`index.ts`** — Wire learnings capture at Done phase. Pass roadmap and learnings to prompt builder for brainstorm and plan phases.

### New Prompt Template: `capture-learnings.md`

Structured prompt for the Done phase that asks the LLM to reflect on the completed issue and propose learnings entries. Receives the full issue context (spec, plan, what happened during implementation).

### New Prompt Template: `write-changelog.md`

Structured prompt for generating a concise, user-facing changelog entry from issue artifacts.

## Non-Goals

- Relevance filtering for learnings (inject all, let the LLM sort it)
- Auto-generating docs without LLM drafting
- Roadmap modification by the extension (read-only)
- Learnings capture at every phase transition (too noisy)
