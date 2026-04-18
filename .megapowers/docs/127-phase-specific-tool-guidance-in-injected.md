# Feature: Inline phase-specific tool guidance in injected workflow prompts (#127)

## Summary

Added concrete, phase-local tool guidance to the workflow prompt templates so each step points to the most appropriate Pi tool or slash command at the moment it is needed. The change covers feature phases, bugfix phases, and done-phase wrap-up actions.

The implementation preserves the existing prompt-injection architecture. Prompt guidance still ships as plain markdown through the existing injection path; no new assembly layer, overlay system, tool registry, or parallel guidance data store was introduced.

---

## Problem

The workflow prompts described what to do, but many steps did not tell the agent which concrete tool to use when grounding a symbol, checking structural patterns, tracing execution, validating signature changes, or reviewing prompt coverage. That increased the risk of brittle searches, paraphrased signatures, and drift between raw prompt files, injected prompt output, and any mapping documentation.

---

## What Changed

### Prompt updates

Added inline, step-local guidance to these prompt files:

- `prompts/brainstorm.md`
- `prompts/write-spec.md`
- `prompts/write-plan.md`
- `prompts/review-plan.md`
- `prompts/revise-plan.md`
- `prompts/implement-task.md`
- `prompts/verify.md`
- `prompts/code-review.md`
- `prompts/reproduce-bug.md`
- `prompts/diagnose-bug.md`
- `prompts/done.md`

The new hints cover the intended tool mappings from the spec, including:

- `read` with `map: true` or `symbol: "<name>"`
- `symbol_graph` and `symbol_graph` with `include: ["contract"]` / `include: ["source"]`
- `grep` vs `ast_search`
- `impact` for regression and signature-change blast radius
- `trace` for real execution-path evidence
- `bash` for targeted VCS inspection
- `/codex-review` and `/codex-adversarial-review` guidance in code review
- `edit` through hashline anchors during implementation and review fixes

### Documentation

Added `docs/phase-tools.md`, a prompt-to-tool review index that lists, for each touched prompt, the inline-referenced tool or command, the section or step where it appears, and the rationale for that hint.

Prompt markdown remains the source of truth; the doc exists for inspection and drift detection.

### Regression coverage

Added and expanded regression tests so the guidance is enforced in three places:

- raw prompt content checks in `tests/phase-tool-guidance.test.ts`
- exact-sync rendering checks for `docs/phase-tools.md`
- injected-prompt checks in `tests/prompt-inject.test.ts`

---

## Injection Path Preserved

No runtime injection architecture was replaced.

The existing injection path remains:

- `buildInjectedPrompt(cwd: string, store?: Store): string | null`
- `onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any>`

`onBeforeAgentStart(...)` still calls `buildInjectedPrompt(...)` and returns the assembled prompt as `message.content`, so the new guidance is delivered through the same mechanism as before.

---

## Files Changed

```text
prompts/brainstorm.md
prompts/write-spec.md
prompts/write-plan.md
prompts/review-plan.md
prompts/revise-plan.md
prompts/implement-task.md
prompts/verify.md
prompts/code-review.md
prompts/reproduce-bug.md
prompts/diagnose-bug.md
prompts/done.md
docs/phase-tools.md
tests/phase-tool-guidance.test.ts
tests/prompt-inject.test.ts
.megapowers/plans/127-phase-specific-tool-guidance-in-injected/spec.md
.megapowers/plans/127-phase-specific-tool-guidance-in-injected/plan.md
.megapowers/plans/127-phase-specific-tool-guidance-in-injected/verify.md
.megapowers/plans/127-phase-specific-tool-guidance-in-injected/code-review.md
```

---

## Backward Compatibility

- No new tool-resolution runtime was introduced.
- No workflow config format changed.
- No new prompt assembly mechanism was added.
- Existing prompt injection behavior outside the intended text edits remains green.
- No schema migrations or user-facing data migrations are required.

---

## Test Results

```text
bun test
797 pass, 0 fail — 79 files

bun test tests/phase-tool-guidance.test.ts tests/prompt-inject.test.ts
53 pass, 0 fail — 2 files

bun test tests/index-integration.test.ts tests/hooks.test.ts tests/hooks-focused-review.test.ts
25 pass, 0 fail — 3 files
```
