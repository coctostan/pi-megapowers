# Code Review — #118

## Files Reviewed

| File | Change |
|------|--------|
| `prompts/brainstorm.md` | Full rewrite — replaced prose-summary model with structured requirements-capture contract |
| `prompts/write-spec.md` | Full rewrite — added `No silent drops`, `Legacy handling`, `Requirement Traceability` sections |
| `tests/prompts.test.ts` | New `describe` block with 7 tests locking the #118 contracts |
| `README.md` | Two clarifying sentences added about the requirements-first brainstorm/spec model |
| `CHANGELOG.md` | One bullet added to `## [Unreleased] / ### Changed` |

---

## Strengths

- **`brainstorm.md` — Mode triage is prominent and well-structured** (`prompts/brainstorm.md:14–30`). The `## Start by triaging the mode` section with `### Exploratory` / `### Direct requirements` sub-headings and decision criteria is exactly the right UX: the agent self-classifies early rather than guessing mid-conversation.

- **`brainstorm.md` — "Core rule" is unambiguous** (`prompts/brainstorm.md:51–63`). The five ID types are bolded, defined with examples, and the "do not silently drop" rule is a direct imperative — no wiggle room.

- **`brainstorm.md` — "Before saving" checklist is actionable** (`prompts/brainstorm.md:133–141`). Each bullet maps directly to a failure mode. The checklist is terse and easy to follow.

- **`write-spec.md` — Legacy handling is conservative by default** (`prompts/write-spec.md:31–39`). Extract → confirm → write is the right sequence; "Do not silently guess" is a clear directive that prevents the agent from hallucinating implied requirements.

- **`write-spec.md` — Traceability examples are realistic** (`prompts/write-spec.md:93–101`). The `R3 -> Out of Scope` and `R4 -> Open Question Q1` examples cover the non-obvious cases that authors often forget.

- **Tests — Contract is locked with high specificity** (`tests/prompts.test.ts:455–500`). The mix of `toContain` (for literal headings) and `toMatch` with alternating regex (for equivalent phrasings) is the right balance — not brittle to minor wording tweaks, but not so loose that the contract can silently degrade.

---

## Findings

### Critical
None.

### Important
None.

### Minor

1. **`README.md:78–79` — Missing blank line before `## TDD enforcement`**
   The new paragraph at line 78 was written directly adjacent to the next section heading with no blank line separator, making the markdown render run them together in some renderers.
   **Fixed in this session** — blank line inserted between the new paragraph and `## TDD enforcement`.

2. **`tests/prompts.test.ts:475–495` — Missing blank lines between `it()` blocks in the `#118` describe block**
   Three pairs of adjacent `it()` blocks had no blank separator line, inconsistent with all other describe blocks in the file (which uniformly use blank lines between `it()` calls).
   **Fixed in this session** — blank lines inserted after each `it()` closing brace within the new describe block.

---

## Recommendations

- **Prompt authors: consider adding one negative example to `brainstorm.md`'s `## Must-Have Requirements` rules.** The current rules are all "do this" — adding "not this" (e.g., `❌ R1: Improve UX` / `✅ R1: The issue list filters by label using a multi-select dropdown`) would help prevent vague `R#` entries that defeat the contract at the next phase. This is out of scope for #118 (`O1`) but is the natural next iteration.

- **Prompt contract tests: separate the two `describe` halves into sibling describes.** Currently all 7 tests live in one `describe("prompt templates — #118 requirements artifacts contract", ...)`. Splitting into `describe("... brainstorm contract", ...)` and `describe("... spec contract", ...)` would make test filter targets (`bun test -t "..."`) more precise and improve failure locality. Low-effort future cleanup.

---

## Test Suite Results (post-fixes)

```
bun test
 923 pass
 0 fail
 2190 expect() calls
Ran 923 tests across 93 files. [1240ms]
```

---

## Assessment

**ready**

All 13 acceptance criteria met (confirmed in verify phase). The implementation is prompt/test/doc-only — no runtime logic changed, no migration needed, no breaking changes. Two minor style issues (missing blank lines) were patched inline; all tests remain green.
