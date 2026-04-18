## Files Reviewed
- `prompts/brainstorm.md` — added inline `## Read first` tool-routing guidance for early discovery and history checks.
- `prompts/write-spec.md` — added symbol-grounding guidance in `## Purpose` and `## Legacy handling`.
- `prompts/write-plan.md` — added codebase-grounding, batching, signature-change, and coverage-check hints in planning instructions and task template.
- `prompts/review-plan.md` — added criterion-local guidance for mechanical coverage, dependency, signature, and realism checks.
- `prompts/revise-plan.md` — added revision-time grounding hints plus coverage/signature-change failure checks.
- `prompts/implement-task.md` — added signature, anchored-edit, regression, and drift-recovery guidance.
- `prompts/verify.md` — added `impact`, `symbol_graph`, `ast_search`, and `trace` evidence guidance.
- `prompts/code-review.md` — added early codex-review guidance plus contract/signature-change/fix-loop hints.
- `prompts/reproduce-bug.md` — added source, git-history, trace, and signature-grounding hints.
- `prompts/diagnose-bug.md` — added trace, caller inspection, contract, and risk-surface hints.
- `prompts/done.md` — added signature and symbol-location grounding hints for generated docs/summaries.
- `docs/phase-tools.md` — added prompt-to-tool mapping documentation for all touched prompts.
- `tests/phase-tool-guidance.test.ts` — added exact-snippet assertions and exact-sync drift checks for the doc map.
- `tests/prompt-inject.test.ts` — added injected-prompt regression coverage for representative inline hints.
- `extensions/megapowers/prompt-inject.ts` — reviewed the unchanged injection path around `buildInjectedPrompt(cwd: string, store?: Store): string | null` for compatibility and prompt assembly behavior.
- `extensions/megapowers/hooks.ts` — reviewed `onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any>` to confirm the injected prompts still flow through the existing hook.

## Strengths
- `prompts/brainstorm.md:32-38` keeps the new guidance embedded directly inside the existing `## Read first` checklist instead of appending a separate block, which satisfies the prompt-size and architecture constraints cleanly.
- `prompts/write-plan.md:46-55` and `prompts/write-plan.md:74-93` are disciplined about putting each tool hint at the exact step where misuse would happen: grounding before task authoring, failure-text probing in Step 2, and `impact` only where signature changes matter.
- `prompts/code-review.md:17-19` adds reviewer-tool guidance without changing the actual code-review control flow, and `prompts/code-review.md:88-107` correctly tightens fix-loop instructions around anchored reads rather than inventing a new mechanism.
- `docs/phase-tools.md:1-116` is narrow and descriptive: it documents the prompt-local hints without becoming a second source of truth.
- `tests/phase-tool-guidance.test.ts:15-145` is appropriately strict about the required phrases, and `tests/phase-tool-guidance.test.ts:293-295` gives an exact drift check for `docs/phase-tools.md`, which is the right guardrail for this issue.
- `tests/prompt-inject.test.ts:521-567` verifies representative prompt injection across feature, bugfix, and done phases, so the new text is validated on the real `buildInjectedPrompt(cwd: string, store?: Store): string | null` path rather than only as raw file content.
- `extensions/megapowers/prompt-inject.ts:214-252` preserves the existing prompt assembly architecture. `buildInjectedPrompt(cwd: string, store?: Store): string | null` still interpolates plain markdown prompt files and does not introduce any new assembly layer or tool-guidance registry.
- `extensions/megapowers/hooks.ts:64-76` keeps `onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any>` as the single runtime hook that injects the assembled prompt, which matches the architectural constraint in the spec.

## Findings

### Critical
None.

### Important
None.

### Minor
None.

## Recommendations
- `/codex-review --base <ref>` was requested by the prompt, but that slash command is not available in this tool environment. No finding follows from that absence, and the review instead used direct diff inspection, source reads, `symbol_graph`, `impact`, and fresh test runs. If this command is expected to be mandatory in code-review sessions, expose it in the runtime or clarify the fallback path in reviewer guidance.
- Keep using the exact-sync rendering approach in `tests/phase-tool-guidance.test.ts`; for prompt-heavy issues, that pattern is materially better than looser substring-only doc checks.

## Assessment
ready

The change is production-ready. I found no correctness, maintainability, architectural, or test-quality issues that should block merge.

Adopted/rejected external-review findings:
- Adopted: none. `/codex-review --base <ref>` was not executable in this environment, so there were no machine-review findings to adopt.
- Rejected: none. There were no external findings to reject.

Additional verification performed for this review:
- Reviewed the real injection path through `extensions/megapowers/hooks.ts:64-76` and `extensions/megapowers/prompt-inject.ts:106-265`.
- Ran `symbol_graph` with `include: ["contract"]` on `buildInjectedPrompt(cwd: string, store?: Store): string | null`; the observed guards are `!state.megaEnabled` and `!state.activeIssue || !state.phase`, and the diff does not violate them.
- Ran `impact` with `changeType: "signature_change"` on `buildInjectedPrompt`; surfaced dependents were `onBeforeAgentStart` and `megapowers`, with no uncovered breaking-change action required because the function signature in the code remains `(cwd: string, store?: Store) => string | null`.
- Re-ran targeted regression tests: `bun test tests/phase-tool-guidance.test.ts tests/prompt-inject.test.ts` → `53 pass, 0 fail`.
- Re-ran the full suite: `bun test` → `797 pass, 0 fail`.
