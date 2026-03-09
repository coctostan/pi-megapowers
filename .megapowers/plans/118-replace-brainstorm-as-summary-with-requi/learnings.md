# Learnings — #118

## 2026-03-09 — 118-replace-brainstorm-as-summary-with-requi

- **Prompt-contract tests are cheap and high-value insurance.** Seven `toContain`/`toMatch` assertions on `getPhasePromptTemplate()` lock behavioral contracts that would otherwise silently degrade across future prompt edits. The pattern — literal `toContain` for exact headings, `toMatch` with alternating regex for semantically equivalent phrasings — balances brittleness and precision well. Every significant prompt should have a corresponding contract test block.

- **Mode triage early in the conversation eliminates the most common brainstorm failure mode.** Without explicit mode selection, agents default to exploratory discussion even when the user already has concrete requirements. Making `### Exploratory` vs `### Direct requirements` the first decision in the prompt forces the right conversation shape from turn 1.

- **"No silent drops" is a better framing than "traceability".** Traceability sounds like a documentation chore; "no R# may be omitted" is a testable binary rule. The prompt test that asserts `toContain("every \`R#\` must appear exactly once")` is directly readable as a contract clause, not an audit trail.

- **Legacy handling in spec prompts prevents a painful silent failure on older artifacts.** Without it, an agent reading a prose-heavy brainstorm would either invent R# IDs (hallucination) or skip traceability entirely (silent drop). The extract → confirm → write flow is the right conservative default: slow but correct.

- **Verify-and-patch tasks ("check first, add only gaps") work well for prompt-only issues.** All five tasks followed the same structure: read the file, check against a checklist, patch only missing elements, run the tests. This approach is safe because the tests immediately catch any over-patching or missed element. For pure-prompt issues, this pattern is more reliable than "rewrite from scratch" and produces smaller, more reviewable diffs.

- **Blank lines between `it()` blocks in test files matter for readability.** The test block added in this issue initially had no blank lines between adjacent `it()` calls, inconsistent with the rest of the file. Caught and fixed in code review. Enforce this in future prompt-contract test additions.

- **The `brainstorm` → `spec` handoff is the highest-leverage place to prevent requirements drift.** Fixing it at the prompt level (rather than building a runtime traceability system) is the right YAGNI decision — the full E2E traceability graph (D3) can be added later if needed. Prompt + test coverage gets 80% of the value at 5% of the cost.
