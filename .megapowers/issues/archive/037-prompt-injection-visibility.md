---
id: 37
type: feature
status: done
created: 2026-02-23T23:30:00.000Z
---

# Prompt injection is invisible — user has no way to know it happened

`buildInjectedPrompt()` in `prompt-inject.ts` assembles a context-rich system prompt (protocol, phase template, acceptance criteria, task vars, artifacts, tool instructions) and injects it via the `before_agent_start` hook in `index.ts`. The injection uses `display: false`, making it completely invisible to the user:

```ts
return {
  message: {
    customType: "megapowers-context",
    content: prompt,
    display: false,   // ← user sees nothing
  },
};
```

The user has no way to know:
- Whether injection happened at all (maybe megaEnabled=false, no active issue)
- Which phase the LLM was briefed on
- What artifacts/task context was included
- Why the LLM is behaving differently than expected

This makes debugging workflow problems nearly impossible and makes the extension feel like a black box.

## Expected behaviour

When prompt injection occurs, show a compact status indicator — either in the dashboard widget, the status bar, or as a collapsible notification — such as:

```
⚡ Megapowers context injected — phase: implement, task 2/4, 3 artifacts
```

The indicator should be dismissible or auto-expire (not permanent noise). Optionally, a `/mega context` command could show the full injected prompt for debugging.

## Affected files
- `extensions/megapowers/index.ts` — `before_agent_start` hook (line ~161)
- `extensions/megapowers/prompt-inject.ts` — `buildInjectedPrompt()`
- `extensions/megapowers/ui.ts` — status/widget rendering
