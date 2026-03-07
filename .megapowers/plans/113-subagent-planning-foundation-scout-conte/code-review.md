# Code Review — Issue 113

## Files Reviewed

- **`.pi/agents/plan-scout.md`** (new, 52 lines) — project-scoped planning scout agent definition
- **`.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`** (modified, +11 lines) — V1 rollout section added; artifact-layout scoping sentence added
- **`prompts/implement-task.md`** (modified, +3/-1 lines) — blanket "broken" wording replaced with phase-scoped restriction

---

## Strengths

**`.pi/agents/plan-scout.md`:**
- **Fail-closed input handling** (lines 14–15): the scout explicitly stops if neither planning artifact exists and does not fall back to a repo-only summary. This is the right default — permissive fallback would produce valueless or misleading context.
- **Precise tool list** (line 5): `read, write, bash, grep, find, ls` is minimal and intentional. `write` is included (needed to produce `context.md`), `edit` is correctly omitted (the scout creates context fresh each run, never patches it).
- **Authority boundaries section** (lines 23–30): enumerates every forbidden tool by exact name (`megapowers_plan_task`, `megapowers_plan_review`, `megapowers_signal`, `state.json`). Listing them explicitly is better than a vague "do not use megapowers tools" — it closes the loophole of a model interpreting a vague rule as "use different wording."
- **Output section structure** (lines 36–43): enumerates the seven required sections as a numbered list, giving the model a concrete checklist rather than open-ended prose instructions.

**`095-subagent-assisted-plan-review-decomposition.md`:**
- **V1 rollout section** (lines 83–92): clearly states the external `pi-subagents` extension is the delivery mechanism, avoiding the need for new megapowers runtime changes. The advisory/non-canonical framing is stated in one sentence that will be easy to grep.
- **Artifact layout scoping** (line 154–155): directly reconciles the root-level v1 path with the future `subagents/draft/` layout in the same paragraph, preventing reader confusion about the two paths coexisting.

**`prompts/implement-task.md`:**
- The new two-sentence structure (lines 26, 28) keeps the behavioral restriction (`do not use pipeline/subagent for implementation`) and adds one explanatory sentence for the carve-out. The test at `tests/prompts.test.ts:312` still matches (`do not use.*pipeline` regex) — confirmed by test run.

---

## Findings

### Critical
None.

### Important
None.

### Minor

**1. `plan-scout.md` line 12–13: "active" `spec.md`/`diagnosis.md` — path is unspecified**
The prompt says "read the active `spec.md`" but doesn't tell the scout where to look. In practice, megapowers stores specs at `.megapowers/plans/<issue-slug>/spec.md`. A model that reads this prompt cold may look in the repo root or current directory and miss the file.

The `Required input` section could add:
```
- For feature workflows, read `.megapowers/plans/<issue-slug>/spec.md`.
- For bugfix workflows, read `.megapowers/plans/<issue-slug>/diagnosis.md`.
```
This is a minor issue because (a) the agent will typically be invoked by a user who knows the issue slug, and (b) a capable model will find the file via `find`/`bash`. But explicit paths improve reliability.

**2. `plan-scout.md` line 34: `<issue-slug>` placeholder is not explained**
The output path `.megapowers/plans/<issue-slug>/context.md` uses an angle-bracket placeholder but the prompt never tells the scout how to determine the issue slug (e.g., from state.json, from the issue directory, or from user input). This is coherent because the agent is expected to be invoked with context, but a short sentence in `## Output` clarifying the source would remove ambiguity.

**3. `095-...decomposition.md` line 83: `## V1 project-scoped scout rollout` is an H2 directly after the `## Phase 2 — ...` H2**
`Phase 2` has no body — its content starts immediately with `## V1 project-scoped scout rollout`. This gives the impression they are siblings at the same level, which they conceptually are not (V1 rollout is the first instance of Phase 2). The pre-existing `## Draft Assist`, `## Review Assist`, etc. headings also all use H2, so this matches the document's existing (flat) convention. No structural breakage. Note for future refactor.

---

## Recommendations

1. **Add explicit paths for `spec.md`/`diagnosis.md` in `plan-scout.md`** — even just a parenthetical `(at `.megapowers/plans/<issue-slug>/spec.md`)` after the instruction would close the ambiguity without changing the structure.

2. **Consider `## Context` or `## Invocation` section in `plan-scout.md`** — the other agents (`implementer.md`, `reviewer.md`) are terse because they receive rich context from the pipeline. The plan-scout is expected to be run manually via `pi-subagents`. A brief invocation note (e.g., "you will be given the issue slug and the active plan directory") would help users and the model orient faster.

3. **No new runtime tests are needed** — these are prompt/doc files and the `[no-test]` justifications hold. The existing `tests/prompts.test.ts:308` test provides adequate regression coverage for the implement-task change.

---

## Assessment

**ready**

All three changes are correct, consistent with codebase conventions, and do not introduce breaking changes. The two minor findings (implicit `spec.md` path, unexplained `<issue-slug>` placeholder) are quality-of-life improvements for future prompt iterations, not blockers. The test suite passes (893/893) with no regressions.
