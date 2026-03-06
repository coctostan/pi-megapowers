# Code Review — Issue 092: Two-Tier Plan Validation

## Fix Applied Before Review

**Critical bug found at review start:** `register-tools.ts` imported `complete` from `"@mariozechner/pi-ai/dist/stream.js"`. The pi-coding-agent's bundled `@mariozechner/pi-ai` has a strict `exports` map with only `.`, `./oauth`, and `./bedrock-provider` — no `./dist/stream.js` subpath. The module resolver mangled the path to `.../dist/index.js/dist/stream.js`, causing the extension to fail to load entirely.

**Fix applied:** Changed to `import { complete } from "@mariozechner/pi-ai"` — the `.` export re-exports everything from `stream.js` in the pi-coding-agent's version (`export * from "./stream.js"` in that bundled `index.d.ts`).

Tests re-confirmed after fix: **872 pass, 2 fail** (same 2 pre-existing failures, unrelated).

---

## Files Reviewed

| File | Description |
|------|-------------|
| `extensions/megapowers/validation/plan-task-linter.ts` | New — pure `lintTask()` function (T0) |
| `extensions/megapowers/validation/plan-lint-model.ts` | New — T1 model lint, prompt builder, response parser |
| `extensions/megapowers/tools/tool-plan-task.ts` | Modified — T0 lint integrated into create/update paths |
| `extensions/megapowers/tools/tool-signal.ts` | Modified — `handlePlanDraftDone` made async, T1 integrated |
| `extensions/megapowers/register-tools.ts` | Modified — `buildLintCompleteFn`, async dispatch for `plan_draft_done` |
| `prompts/lint-plan-prompt.md` | New — T1 model instruction template |
| `prompts/review-plan.md` | Modified — mechanical checks removed, focused on architecture |
| `tests/plan-task-linter.test.ts` | New — unit tests for `lintTask()` |
| `tests/plan-lint-model.test.ts` | New — unit tests for `lintPlanWithModel()` and `buildLintPrompt()` |
| `tests/tool-plan-task.test.ts` | Extended — T0 integration tests |
| `tests/tool-signal.test.ts` | Extended — T1 integration tests, graceful degradation |

---

## Strengths

- **`lintTask()` is genuinely pure** (`plan-task-linter.ts`): no I/O, no imports beyond types, all checks operate on primitives and sets. The discriminated union return type `{ pass: true } | { pass: false; errors: string[] }` is clean and eliminates null checks at call sites.
- **Self-update non-conflict is correctly handled** (`plan-task-linter.ts` line 42): `if (existing.id === task.id) continue` skips the task being updated when checking `files_to_create` duplicates, preventing false positives on updates.
- **Fail-open semantics are thorough** (`plan-lint-model.ts` lines 68–72): both "fail with no findings" and unparseable JSON are treated as pass-with-warning. API errors are also caught (`lintPlanWithModel` lines 30–33). No code path can make T1 block progress due to a model error.
- **`completeFn` injection is clean** — tests use mocks without any API key setup; the production `buildLintCompleteFn` wires the real model. The boundary is clear.
- **T1 graceful degradation message chain** is well-structured: API error → `lintPlanWithModel` returns pass+warning → `handlePlanDraftDone` propagates it to the result message → user sees `⚠️` in tool output.
- **`review-plan.md` update** is precise — line 19 explicitly defers mechanical checks to T0/T1, and section 6 is updated to remove file-path/description completeness items. The rest of the deep-review criteria (TDD correctness, API accuracy, granularity) are unchanged and remain appropriate for T2.
- **Test coverage is meaningful**: tests verify exact error messages (not just `pass === false`), edge cases (self-reference in `depends_on`, self-update in `files_to_create`), and the full transition lifecycle (planMode stays `"draft"` on T1 fail).

---

## Findings

### Critical

**Fixed before this report:** Bad subpath import `"@mariozechner/pi-ai/dist/stream.js"` in `register-tools.ts:6` caused extension load failure. Fixed to `"@mariozechner/pi-ai"`.

No remaining critical findings.

### Important

**1. `export type CompleteFn` before imports — `plan-lint-model.ts:1`**
```ts
export type CompleteFn = (prompt: string) => Promise<string>;
import { loadPromptFile, interpolatePrompt } from "../prompts.js";
```
TypeScript allows declarations before imports, but this is unconventional and breaks the standard module structure (imports first, then exports). The `CompleteFn` type is only used by `lintPlanWithModel`'s parameter — it belongs after the imports.

**Fix applied:** Moved `CompleteFn` declaration to after the import line. TypeScript still compiles clean.

**2. `handleSignal` still lists `"plan_draft_done"` in its action union — `tool-signal.ts:28-29`**
```ts
action:
  | "plan_draft_done"
```
...and immediately returns an error:
```ts
case "plan_draft_done":
  return { error: "plan_draft_done must be called via the async handlePlanDraftDone export." };
```
This is a placeholder to catch callers who still go through `handleSignal`. However, the error message says "via the async handlePlanDraftDone export" — this is an internal implementation detail not useful to an end user. If `plan_draft_done` reaches `handleSignal`, it means `register-tools.ts` wired it incorrectly. The error message should say something the drafter can act on: e.g. `"plan_draft_done is not supported here — this is a bug in the extension."` (Not urgent, but the current message will confuse a user who sees it.)

### Minor

**3. Fallback inline prompt in `buildLintPrompt` is untested — `plan-lint-model.ts:50-51`**
```ts
// Fallback if template not found
return `## Spec\n${specContent}\n\n## Plan Tasks\n${taskList}\n\nCheck: spec coverage, dependency coherence, description quality, file path plausibility. Respond with JSON: {"verdict": "pass"|"fail", "findings": [...]}`;
```
Good defensive coding, but the test `"includes the lint-plan-prompt.md template content"` verifies only the template path (which checks for "Spec coverage", "Dependency coherence", etc. from the .md file). If `loadPromptFile` returns null for some reason at runtime, the fallback prompt is used, but it's never tested. Low risk — the template file is in source control.

**4. Model ID ordering in `buildLintCompleteFn` — `register-tools.ts:24-25`**
```ts
modelRegistry.find("anthropic", "claude-haiku-4-5") ??
modelRegistry.find("anthropic", "claude-3-5-haiku-latest");
```
`claude-haiku-4-5` is tried first (newer, more capable). `claude-3-5-haiku-latest` is the fallback. This is correct ordering but not documented. A comment explaining "prefer newer Haiku 4.5, fall back to 3.5" would help future maintainers understand the intent.

**5. `TaskSummary` interface is unexported but duplicated by the caller's data shape — `plan-lint-model.ts:8-13`**
The `TaskSummary` interface is private to the module. `handlePlanDraftDone` constructs objects matching this shape inline:
```ts
const taskSummaries = tasks.map((t) => ({
  id: t.data.id, title: t.data.title, description: t.content,
  files: [...t.data.files_to_modify, ...t.data.files_to_create],
}));
```
TypeScript structurally validates this at compile time (no error), so there's no bug. But exporting `TaskSummary` would make the contract explicit. Low priority.

---

## Recommendations

1. **Move `export type CompleteFn` after imports** in `plan-lint-model.ts` — one-line fix, improves readability.
2. **Consider a system prompt for T1 model calls** — currently only a user message is sent. Using `systemPrompt` in the `Context` to separate role instructions from task content would improve model adherence to the JSON format requirement.
3. **The 200-character minimum description threshold is hardcoded** — per spec, this is intentional ("out of scope: configurable T0 thresholds"). Worth adding a TODO comment near `MIN_DESCRIPTION_LENGTH = 200` so future configurability isn't forgotten.

---

## Post-Fix Test Results

```
bun test
 872 pass
 2 fail (pre-existing, unrelated to this feature)
Ran 874 tests across 78 files.

bun test tests/plan-task-linter.test.ts tests/plan-lint-model.test.ts tests/tool-plan-task.test.ts tests/tool-signal.test.ts
 117 pass
 0 fail
```

TypeScript: `bunx tsc --noEmit` → `✓ Build successful (0 units compiled)`

---

## Assessment

**ready**

The critical load-breaking import bug was caught and fixed during this review session. After the fix, the extension loads correctly, all feature tests pass, and TypeScript compiles clean. The remaining findings are minor style issues that don't affect correctness or safety. The two-tier validation architecture is sound, the fail-open semantics are well-implemented, and the test coverage is meaningful.
