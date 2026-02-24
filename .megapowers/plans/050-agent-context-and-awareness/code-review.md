## Code Review — 050-agent-context-and-awareness

### Scope

Full diff: `ozyystnz-..@` (implement start → current HEAD)

**Changed files:**
- `extensions/megapowers/prompt-inject.ts` (+7/-3)
- `extensions/megapowers/write-policy.ts` (+12/-5)
- `prompts/base.md` (new, +29)
- `prompts/implement-task.md` (+6)
- `prompts/write-plan.md` (+1)
- `tests/base-prompt.test.ts` (new, +34)
- `tests/prompt-content.test.ts` (new, +28)
- `tests/prompt-inject.test.ts` (+24/-3)
- `tests/prompt-templates.test.ts` (new, +96)
- `tests/write-policy.test.ts` (new, +85)

---

## Findings

### Critical

None.

---

### Important

None.

---

### Minor

**1. `base.md` duplicates `megapowers-protocol.md` content in full (by design, accepted trade-off)**

`diff <(cat prompts/megapowers-protocol.md) <(head -20 prompts/base.md)` produces no output — the first 20 lines of `base.md` are character-for-character identical to all of `megapowers-protocol.md`. The remaining 9 lines of `base.md` are the "Getting Started" section.

The active-issue path injects `megapowers-protocol.md`; the no-issue path injects `base.md` (which is the protocol + Getting Started). If the protocol changes (e.g., a new tool action is added to `megapowers_signal`), both files need updating. There is no test or mechanism to keep them in sync.

This is a **known trade-off** — AC4 explicitly requires `base.md` to be "standalone" and "the only template used" by the no-issue path, which precludes a multi-file load approach. The duplication is 20 lines and the protocol is stable. Note for future: if the protocol evolves frequently, consider building `base.md` from a template that references `megapowers-protocol.md` or using a shared constant.

*No fix required; note for future AC4 revision if protocol churn increases.*

---

**2. Test files read prompt files once per `it()` rather than once in `beforeAll`**

`tests/base-prompt.test.ts` (lines 12, 17, 22, 27, 32) reads `base.md` five times, once per `it()`. `tests/prompt-content.test.ts` reads `write-plan.md` twice and `implement-task.md` twice. A `beforeAll` with a shared variable would be cleaner and faster, though the performance impact is negligible (5 small file reads).

*Cosmetic. No fix required.*

---

## Code Quality Observations (no issues)

**`write-policy.ts`** — The refactor is clean. Moving `isAllowlisted()` before `BLOCKING_PHASES` into a single unconditional check eliminates the previous duplication (it was checked twice: once for TDD phases and separately for blocking phases). Adding `"reproduce"` and `"diagnose"` to `BLOCKING_PHASES` correctly closes a gap where bugfix phases weren't explicitly blocked.

**`prompt-inject.ts`** — The three-tier logic (mega-off → null, no-issue → base.md, active-issue → full injection) is clear and follows a clean early-return pattern. The single-line change (`return base || null` replaces `return null`) is surgical and correct.

**`prompts/base.md`** — Static template, no `{{vars}}`, appropriate scope. Describes tools accurately and gives actionable "Getting Started" guidance.

**`prompts/write-plan.md`** — Single-line addition fits naturally into the existing task-rules list. Clear and complete.

**`prompts/implement-task.md`** — `## Type-Only Tasks` section is well-placed (between the refactor recipe and the rules list), covers both the plan-level `[no-test]` path and the runtime `/tdd skip` escape hatch.

**`tests/prompt-templates.test.ts`** — Dynamic test generation for AC10 is well-architected. `SKIP_TEMPLATES` and `TEMPLATE_PHASE_MAP` are explicit and self-documenting. The guard that throws on unmapped templates (`throw new Error(...)`) is the right way to make the test self-extending — new templates will cause a CI failure rather than silently being skipped. `beforeEach`/`afterEach` with real filesystem state is appropriate since `buildInjectedPrompt` requires disk state.

**`tests/write-policy.test.ts`** — Exhaustive matrix coverage (6 allowlisted files × 10 phases = 60 allowlist tests, plus 8 block tests and 3 TDD-phase tests). Uses parameterised loops rather than copy-paste, which is correct practice for policy matrix testing.

---

## Assessment

**ready**

The implementation is minimal, focused, and correct. All 10 acceptance criteria are verified by 650 passing tests. No bugs, no logic gaps, no over-engineering. The two minor findings (protocol duplication by spec design, minor test file-read redundancy) are acceptable and don't warrant blocking merge. Code is consistent with all existing patterns.
