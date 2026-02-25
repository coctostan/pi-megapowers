---
id: 26
type: feature
status: done
created: 2026-02-23T15:32:10.000Z
---

# Triage: LLM-driven batching

Refactor the `/triage` command so that batch creation is driven by the LLM instead of prompting the user through a series of UI inputs (title, type, source IDs, description).

Currently `handleTriageCommand` in `ui.ts` asks the user for batch title, type, source IDs, and description via `ctx.ui.input`/`ctx.ui.select`/`ctx.ui.editor`. Instead, the command should:

1. Gather open issues and present them to the LLM via a triage prompt (prompts/triage.md already exists).
2. Let the LLM analyze the issues and propose batches (grouping, titles, types, descriptions).
3. Parse the LLM's response to extract batch definitions.
4. Create the batch issues automatically from the LLM's output.

This removes the manual interactive prompting and lets the LLM make intelligent grouping decisions.
