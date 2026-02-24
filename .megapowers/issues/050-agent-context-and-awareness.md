---
id: 50
type: feature
status: done
created: 2026-02-24T19:15:00.000Z
sources: [40, 44, 47, 48]
---

# Agent context & awareness — prompt quality, TDD edge cases, and baseline context

Batch addressing gaps in what the LLM knows and when. (1) #048: The agent gets zero megapowers context when no issue is active — `buildInjectedPrompt()` returns null, so the LLM can't help create issues or start workflows. Fix: always inject the base protocol when mega is enabled. (2) #040: Injected prompts haven't been audited for accuracy since the state refactor and TDD signal migration — stale instructions cause the agent to use wrong tool names or skip steps. (3) #047: TDD guard blocks type-only tasks that have no meaningful runtime test to fail. The `[no-test]` annotation and `/tdd skip` exist but the agent doesn't know about them — this is a prompt/guidance gap as much as a tooling one.
