## Test Suite Results

### Full suite
Command run fresh:
```text
$ bun test
...
(pass) phase-specific tool guidance — verify/code-review > verify.md adds impact, symbol_graph, ast_search, and trace evidence hints [0.05ms]
(pass) phase-specific tool guidance — verify/code-review > code-review.md adds codex-review, contract, impact, and anchored-fix hints [0.03ms]
(pass) phase-specific tool guidance — reproduce-bug/diagnose-bug > reproduce-bug.md adds symbol, read, git, trace, and signature hints [0.03ms]
(pass) phase-specific tool guidance — reproduce-bug/diagnose-bug > diagnose-bug.md adds trace, symbol_graph, contract, and impact hints [0.02ms]
(pass) phase-specific tool guidance — done > done.md adds signature and symbol-name grounding to docs/summary actions
(pass) phase-specific tool guidance — mapping doc > docs/phase-tools.md stays exactly in sync with the expected prompt/tool map [0.54ms]
...
797 pass
0 fail
1927 expect() calls
Ran 797 tests across 79 files. [1395.00ms]
```

### Impact / downstream dependents
Command run fresh:
```text
$ impact(symbols=["buildInjectedPrompt"], changeType="behavior_change", maxDepth=2)
extensions/megapowers/hooks.ts:64:4afd  onBeforeAgentStart  behavioral  depth:1  [fan-in:1, fan-out:2, roles:none, coverage:untested, co-change:8.00, chain-confidence:0.90]
extensions/megapowers/index.ts:15:00d8  megapowers  behavioral  depth:2  [fan-in:0, fan-out:18, roles:entry-point, coverage:untested, co-change:5.00, chain-confidence:0.90]
```

Command run fresh to confirm surfaced dependents have tests in the suite:
```text
$ bun test tests/index-integration.test.ts tests/hooks.test.ts tests/hooks-focused-review.test.ts
...
tests/index-integration.test.ts:
(pass) index.ts architectural invariants > session_start without jj requirement > onSessionStart does not require jj and still renders dashboard [1.36ms]

tests/hooks.test.ts:
(pass) onAgentEnd — done-phase doneActions cleanup > populates doneActions (and sets doneChecklistShown) when in done phase with empty doneActions [1.90ms]
...

tests/hooks-focused-review.test.ts:
(pass) preparePlanReviewContext > soft-fails when focused review fan-out throws so review can still proceed [1.95ms]

25 pass
0 fail
45 expect() calls
Ran 25 tests across 3 files. [539.00ms]
```

### Prompt-guidance regression tests
Command run fresh:
```text
$ bun test tests/phase-tool-guidance.test.ts tests/prompt-inject.test.ts
...
(pass) buildInjectedPrompt — inline phase tool guidance > injects representative inline hints for feature phases [2.41ms]
(pass) buildInjectedPrompt — inline phase tool guidance > injects representative inline hints for bugfix and done prompts [1.24ms]
(pass) phase-specific tool guidance — brainstorm/write-spec > brainstorm.md inlines the required Read first tool hints [0.05ms]
(pass) phase-specific tool guidance — mapping doc > docs/phase-tools.md stays exactly in sync with the expected prompt/tool map [0.31ms]

53 pass
0 fail
171 expect() calls
Ran 53 tests across 2 files. [200.00ms]
```

### Prompt-injection path evidence
`symbol_graph` / `trace` / source inspection on the real injection path:
```text
$ symbol_graph(name="buildInjectedPrompt", file="extensions/megapowers/prompt-inject.ts")
## buildInjectedPrompt (function)
extensions/megapowers/prompt-inject.ts:106:1c35
Signature: (cwd: string, store?: Store) => string | null
Callers (1): onBeforeAgentStart
```

```text
$ symbol_graph(name="onBeforeAgentStart", file="extensions/megapowers/hooks.ts")
## onBeforeAgentStart (function)
extensions/megapowers/hooks.ts:64:4afd
Signature: (_event: any, ctx: any, deps: Deps) => Promise<any>
Callers (1): megapowers
Callees (2): preparePlanReviewContext, buildInjectedPrompt
```

```text
$ trace(entry="onBeforeAgentStart", file="extensions/megapowers/hooks.ts")
...
extensions/megapowers/hooks.ts:64:4afd  onBeforeAgentStart
extensions/megapowers/prompt-inject.ts:106:1c35  buildInjectedPrompt
```

Anchored source:
- `extensions/megapowers/hooks.ts:64-76` shows `onBeforeAgentStart` calling `buildInjectedPrompt` and returning the injected prompt as `message.content`.

## Per-Criterion Verification

### Criterion 1: `prompts/brainstorm.md` adds the required inline `## Read first` guidance
**Evidence:**
- `prompts/brainstorm.md:32-38` contains all required inline sentences at `## Read first`:
  - `34`: `Use read with map: true...`
  - `35`: `Use symbol_graph... concrete function, class, or module...`
  - `36`: `Use symbol_graph with include: ["contract"]...`
  - `37`: `Use grep... use ast_search...`
  - `38`: `run git log --oneline -20 -- <path> via bash...`
- `tests/phase-tool-guidance.test.ts:15-25` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — brainstorm/write-spec > brainstorm.md inlines the required Read first tool hints`.
**Verdict:** pass

### Criterion 2: `prompts/write-spec.md` adds `symbol_graph` guidance in `## Purpose` and legacy symbol verification in `## Legacy handling`
**Evidence:**
- `prompts/write-spec.md:14-21` adds the `symbol_graph` and `symbol_graph` contract guidance under `## Purpose`.
- `prompts/write-spec.md:32-40` adds the legacy-handling bullet: `use symbol_graph to verify every named symbol exists...`.
- `tests/phase-tool-guidance.test.ts:27-34` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — brainstorm/write-spec > write-spec.md adds symbol grounding in Purpose and Legacy handling`.
**Verdict:** pass

### Criterion 3: `prompts/write-plan.md` adds the required batching / grounding hints, Step 1/2/3 hints, and coverage checklist hint
**Evidence:**
- `prompts/write-plan.md:46-55` adds `code_execution`, `symbol_graph`, `symbol_graph` contract, `ast_search`, `impact`, `trace`, and `read` guidance under `## Read the Codebase First`.
- `prompts/write-plan.md:74-85` adds:
  - Step 1 `read` / `symbol_graph` source hint
  - Step 2 `bash` probe hint
  - Step 3 `impact` signature-change hint
- `prompts/write-plan.md:149-155` adds the `grep`-based AC coverage verification hint to `## Pre-Submit Checklist`.
- `tests/phase-tool-guidance.test.ts:37-53` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — write-plan/review-plan > write-plan.md adds batching, symbol, trace, impact, and signature-lifting hints`.
**Verdict:** pass

### Criterion 4: `prompts/review-plan.md` adds the required criterion-local `grep`, `symbol_graph`, `read`, and `ast_search` guidance
**Evidence:**
- `prompts/review-plan.md:25-27` adds the mechanical AC coverage check via `grep`.
- `prompts/review-plan.md:29-31` adds dependency/order validation via `symbol_graph` or `grep`.
- `prompts/review-plan.md:33-41` adds Step 3 API/signature verification via `symbol_graph` and `read`.
- `prompts/review-plan.md:58-60` adds realism verification via `symbol_graph` and `ast_search`.
- `tests/phase-tool-guidance.test.ts:55-63` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — write-plan/review-plan > review-plan.md adds criterion-anchored grep, symbol_graph, read, and ast_search hints`.
**Verdict:** pass

### Criterion 5: `prompts/revise-plan.md` adds the required inline instruction hints, failure bullets, and coverage re-check
**Evidence:**
- `prompts/revise-plan.md:38-46` inserts the required `symbol_graph`, `read`, and `ast_search` bullets between instructions 3 and 4.
- `prompts/revise-plan.md:56-68` adds the missing-coverage `grep` bullet and signature-change `impact` bullet to `## Most Common Revision Failures`.
- `prompts/revise-plan.md:70-81` adds the coverage re-check checklist item.
- `tests/phase-tool-guidance.test.ts:66-77` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — revise-plan/implement-task > revise-plan.md adds symbol, read, ast_search, grep, and impact revision hints`.
**Verdict:** pass

### Criterion 6: `prompts/implement-task.md` adds RED/GREEN/When Stuck guidance for `read`, `symbol_graph`, `edit`, and `impact`
**Evidence:**
- `prompts/implement-task.md:34-41` adds the RED step-1 signature grounding hint using `read` / `symbol_graph` source.
- `prompts/implement-task.md:43-50` adds GREEN step-1 re-read + hashline-anchor `edit` guidance and GREEN step-5 `impact` guidance.
- `prompts/implement-task.md:66-76` adds the drift row in `## When Stuck`.
- `tests/phase-tool-guidance.test.ts:79-87` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — revise-plan/implement-task > implement-task.md adds signature, anchor, impact, and drift-recovery hints`.
**Verdict:** pass

### Criterion 7: `prompts/verify.md` adds `impact`, code-inspection, `trace`, and proof-table guidance
**Evidence:**
- `prompts/verify.md:21-23` adds the Step 1 `impact` instruction.
- `prompts/verify.md:36-39` adds Step 2 code-inspection and `trace` proof hints.
- `prompts/verify.md:61-71` adds the `trace` row to `## What Actually Proves a Claim`.
- `tests/phase-tool-guidance.test.ts:90-100` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — verify/code-review > verify.md adds impact, symbol_graph, ast_search, and trace evidence hints`.
**Verdict:** pass

### Criterion 8: `prompts/code-review.md` adds `/codex-review`, adversarial review, contract, impact, realism, and anchored-fix guidance
**Evidence:**
- `prompts/code-review.md:17-20` adds the `/codex-review --base <ref>` and `/codex-adversarial-review --base <ref>` instructions at the top of `## Instructions`.
- `prompts/code-review.md:26-37` adds the `symbol_graph` contract hint and `impact` signature-change hint.
- `prompts/code-review.md:88-107` tightens the realism rule to prefer `symbol_graph` and `read`, and adds `needs-fixes` guidance to re-read anchored source and re-run `impact` for signature changes.
- `tests/phase-tool-guidance.test.ts:102-112` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — verify/code-review > code-review.md adds codex-review, contract, impact, and anchored-fix hints`.
**Verdict:** pass

### Criterion 9: `prompts/reproduce-bug.md` adds source, git-history, trace, and signature guidance
**Evidence:**
- `prompts/reproduce-bug.md:13-24` adds Step 1 `symbol_graph` source + anchored `read`, and Step 2 `bash` `git log --oneline -20 -- <path>` / `git diff <suspect-commit>` guidance.
- `prompts/reproduce-bug.md:31-52` adds Step 4 `trace` guidance and Step 5 `read` with `symbol` guidance.
- `tests/phase-tool-guidance.test.ts:115-124` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — reproduce-bug/diagnose-bug > reproduce-bug.md adds symbol, read, git, trace, and signature hints`.
**Verdict:** pass

### Criterion 10: `prompts/diagnose-bug.md` adds `trace`, caller inspection, contract, and risk-surface guidance
**Evidence:**
- `prompts/diagnose-bug.md:16-27` adds Phase 1 `trace` and `symbol_graph` caller inspection guidance.
- `prompts/diagnose-bug.md:29-35` adds Phase 2 step-4 `symbol_graph` contract + `impact` guidance.
- `prompts/diagnose-bug.md:49-55` adds the after-diagnosis `impact` risk-assessment bullet.
- `tests/phase-tool-guidance.test.ts:126-134` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — reproduce-bug/diagnose-bug > diagnose-bug.md adds trace, symbol_graph, contract, and impact hints`.
**Verdict:** pass

### Criterion 11: `prompts/done.md` adds docs/summary grounding guidance
**Evidence:**
- `prompts/done.md:30-33` adds the `symbol_graph` / `read` signature pull guidance inside `### generate-docs`.
- `prompts/done.md:38-40` adds the `symbol_graph` symbol-name/location verification guidance inside `### generate-bugfix-summary`.
- `tests/phase-tool-guidance.test.ts:137-144` asserts those exact snippets.
- Fresh test output includes: `(pass) phase-specific tool guidance — done > done.md adds signature and symbol-name grounding to docs/summary actions`.
**Verdict:** pass

### Criterion 12: All new tool guidance is step-local, concrete, inline, and not conditionalized on tool availability
**Evidence:**
- Manual inspection shows each new hint appears under the exact requested existing section/step, not as a separate guidance block:
  - `brainstorm.md:32-38`
  - `write-spec.md:14-21, 32-40`
  - `write-plan.md:46-55, 74-85, 149-155`
  - `review-plan.md:25-42, 58-60`
  - `revise-plan.md:38-46, 56-81`
  - `implement-task.md:34-50, 66-76`
  - `verify.md:21-39, 61-71`
  - `code-review.md:17-20, 26-37, 88-107`
  - `reproduce-bug.md:13-24, 31-52`
  - `diagnose-bug.md:16-35, 49-55`
  - `done.md:30-40`
- Fresh search for conditionalization / routing-table language returned zero matches:
```text
$ grep "if available" prompts/... -> 0 matches
$ grep "if registered" prompts/... -> 0 matches
$ grep "tool registry" prompts/... -> 0 matches
$ grep "routing table" prompts/... -> 0 matches
$ grep "tool guidance" prompts/... -> 0 matches
```
- Fresh `tests/phase-tool-guidance.test.ts` run passed all prompt-specific assertions.
**Verdict:** pass

### Criterion 13: `docs/phase-tools.md` exists and documents prompt → tool/step/rationale mappings
**Evidence:**
- `docs/phase-tools.md:1-115` exists and lists every touched prompt file with a table of `Tool / command`, `Section / step`, and `Rationale`.
- `tests/phase-tool-guidance.test.ts:147-149` reads the doc; `153-277` defines the expected prompt/tool map; `293-295` asserts `docs/phase-tools.md` is exactly in sync with the rendered map.
- Fresh test output includes: `(pass) phase-specific tool guidance — mapping doc > docs/phase-tools.md stays exactly in sync with the expected prompt/tool map`.
**Verdict:** pass

### Criterion 14: The implementation stays within the existing prompt-injection architecture and integrates hints inline
**Evidence:**
- Fresh diff inspection shows only prompt/doc/test files changed; no prompt assembly source changed:
```text
$ git diff --name-only -- extensions prompts docs tests
prompts/brainstorm.md
prompts/code-review.md
prompts/diagnose-bug.md
prompts/done.md
prompts/implement-task.md
prompts/reproduce-bug.md
prompts/review-plan.md
prompts/revise-plan.md
prompts/verify.md
prompts/write-plan.md
prompts/write-spec.md
tests/prompt-inject.test.ts

--untracked--
docs/phase-tools.md
tests/phase-tool-guidance.test.ts
```
- The real injection path remains the same:
  - `extensions/megapowers/hooks.ts:64-76` calls `buildInjectedPrompt(...)` and returns the prompt as `message.content`.
  - `symbol_graph(onBeforeAgentStart)` shows callee `buildInjectedPrompt`.
  - `trace(onBeforeAgentStart)` includes `buildInjectedPrompt` on the path.
- Fresh `bun test tests/prompt-inject.test.ts` output passes the injected-prompt checks, including the new inline hints, without any assembly-layer changes.
- Fresh diff stat for tracked changes shows modest prompt-text edits rather than a new assembly system:
```text
prompts/brainstorm.md       |  5 +++++
prompts/code-review.md      |  8 ++++++--
prompts/diagnose-bug.md     |  4 ++++
prompts/done.md             |  2 ++
prompts/implement-task.md   |  4 ++++
prompts/reproduce-bug.md    |  4 ++++
prompts/review-plan.md      |  4 ++++
prompts/revise-plan.md      |  6 ++++++
prompts/verify.md           |  5 +++++
prompts/write-plan.md       | 18 ++++++++++------
prompts/write-spec.md       |  4 +++-
tests/prompt-inject.test.ts | 50 +++++++++++++++++++++++++++++++++++++++++++++
12 files changed, 105 insertions(+), 9 deletions(-)
```
**Verdict:** pass

### Criterion 15: Automated tests fail on missing hints / doc drift / injected prompt regressions, and existing prompt-injection behavior stays green
**Evidence:**
- `tests/phase-tool-guidance.test.ts:15-145` enumerates required prompt-hint snippets for the touched prompt files.
- `tests/phase-tool-guidance.test.ts:293-295` enforces exact doc drift detection against the rendered prompt/tool map.
- `tests/prompt-inject.test.ts:521-566` asserts `buildInjectedPrompt(...)` injects representative inline hints for feature, bugfix, and done prompts.
- Fresh targeted run passed:
```text
$ bun test tests/phase-tool-guidance.test.ts tests/prompt-inject.test.ts
53 pass
0 fail
171 expect() calls
Ran 53 tests across 2 files. [200.00ms]
```
- Fresh full-suite run also passed:
```text
$ bun test
797 pass
0 fail
Ran 797 tests across 79 files. [1395.00ms]
```
That full-suite result is the evidence that existing prompt-injection behavior outside these text changes remained green.
**Verdict:** pass

## Overall Verdict
pass

The implementation satisfies all 15 acceptance criteria.

Key evidence:
- The 11 required prompt templates contain the requested inline tool guidance at the specified sections/steps.
- `docs/phase-tools.md` exists and is exact-sync checked by test.
- The existing injection path remains `megapowers` → `onBeforeAgentStart` → `buildInjectedPrompt`; no new assembly layer or tool-guidance data store was introduced.
- Fresh regression coverage passed at both the targeted level (`53 pass`) and full-suite level (`797 pass`).
- `impact` on `buildInjectedPrompt` surfaced `onBeforeAgentStart` and `megapowers`, and fresh runs of `hooks*.test.ts` and `index-integration.test.ts` covered those downstream dependents.
